const ROOT = "https://www.googleapis.com/";
const failure = (message, code = "DRIVE_ERROR") =>
  Object.assign(new Error(message), { code });
export async function withTimeout(promise, ms, message, code = "TIMEOUT") {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(failure(message, code)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function driveError(status, payload) {
  const details = JSON.stringify(payload || {}),
    reason =
      payload?.error?.errors?.[0]?.reason || payload?.error?.status || "";
  if (status === 401)
    return failure(
      "Google oturumunun süresi doldu. Google Drive’a yeniden bağlan.",
      "AUTH_EXPIRED",
    );
  if (
    status === 403 &&
    /accessNotConfigured|SERVICE_DISABLED|has not been used|not enabled/i.test(
      details,
    )
  )
    return failure(
      "Bu Google Cloud projesinde Drive API etkin değil. Console → APIs & Services → Google Drive API → Enable adımını tamamla.",
      "CONFIGURATION",
    );
  if (status === 403 && /storageQuotaExceeded/i.test(details))
    return failure(
      "Google Drive depolama alanı dolu. Yerel kayıtların korunuyor.",
      "QUOTA",
    );
  if (
    (status === 403 &&
      /rateLimit|RESOURCE_EXHAUSTED|quotaExceeded/i.test(details)) ||
    status === 429
  )
    return failure(
      "Google Drive istek sınırına ulaşıldı. Biraz sonra yeniden dene.",
      "RATE_LIMIT",
    );
  if (status === 403)
    return failure(
      "Google Drive erişimi reddedildi. drive.file iznini, test kullanıcısını ve kuruluş hesabının politikalarını kontrol et. Google Drive’a yeniden bağlan." +
        (reason ? " (Kod: " + reason + ")" : ""),
      "PERMISSION",
    );
  if (status === 404)
    return failure(
      "Seçilen Drive yedeği bulunamadı veya bu uygulama için erişilebilir değil. Listeyi yenile.",
      "NOT_FOUND",
    );
  if (status >= 500)
    return failure(
      "Google Drive şu anda yanıt veremiyor. Yerel kayıtların korunuyor; biraz sonra yeniden dene.",
      "SERVER",
    );
  return failure(
    `Drive işlemi tamamlanamadı (HTTP ${status}). Yerel kayıtların korunuyor.`,
  );
}
export class Drive {
  constructor(
    native,
    isNative,
    fetcher = fetch,
    { requestTimeout = 30000, authTimeout = 125000 } = {},
  ) {
    this.native = native;
    this.isNative = isNative;
    this.fetcher = fetcher;
    this.token = null;
    this.expires = 0;
    this.requestTimeout = requestTimeout;
    this.authTimeout = authTimeout;
    this.authorizing = null;
  }
  filename() {
    const d = new Date(),
      p = (n) => String(n).padStart(2, "0");
    return `kart_takip_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${crypto.randomUUID().slice(0, 8)}.json`;
  }
  async connect(silent = false) {
    if (!this.isNative)
      throw failure(
        "Google Drive bağlantısı Android APK içinde kullanılabilir. Web önizlemede TXT ile yedekleyebilirsin.",
        "NATIVE_REQUIRED",
      );
    if (this.authorizing) return this.authorizing;
    this.authorizing = (async () => {
      try {
        const r = await withTimeout(
          this.native.authorize({ silent }),
          this.authTimeout,
          "Google hesap seçimi tamamlanmadı. Yeniden bağlan; paket/SHA-1 eşleşmesini Ayarlar → Bağlantı tanılama ekranından kontrol et.",
          "AUTH_TIMEOUT",
        );
        if (!r?.token)
          throw failure(
            "Google erişim izni alınamadı. Yeniden bağlan.",
            "AUTH_REQUIRED",
          );
        this.token = r.token;
        this.expires = Date.now() + 50 * 60 * 1000;
      } catch (e) {
        this.token = null;
        this.expires = 0;
        if (e.code === "AUTH_TIMEOUT")
          await this.native.cancelAuthorization?.().catch(() => {});
        throw e;
      } finally {
        this.authorizing = null;
      }
    })();
    return this.authorizing;
  }
  async request(path, options = {}, silent = false, retried = false) {
    if (!this.token || Date.now() > this.expires) await this.connect(silent);
    const controller = new AbortController();
    let timer;
    try {
      const response = await withTimeout(
        (async () => {
          timer = setTimeout(() => controller.abort(), this.requestTimeout);
          const r = await this.fetcher(ROOT + path, {
            ...options,
            signal: controller.signal,
            headers: {
              ...options.headers,
              Authorization: "Bearer " + this.token,
            },
          });
          if (Number(r.headers.get("Content-Length")) > 20 * 1024 * 1024)
            throw failure("Drive yedeği 20 MB sınırını aşıyor.", "TOO_LARGE");
          let text = "";
          if (r.body?.getReader) {
            const reader = r.body.getReader(),
              decoder = new TextDecoder();
            let size = 0;
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 20 * 1024 * 1024) {
                  await reader.cancel();
                  throw failure(
                    "Drive yedeği 20 MB sınırını aşıyor.",
                    "TOO_LARGE",
                  );
                }
                text += decoder.decode(chunk.value, { stream: true });
              }
              text += decoder.decode();
            } finally {
              reader.releaseLock();
            }
          } else text = await r.text();
          return { ok: r.ok, status: r.status, text, headers: r.headers };
        })(),
        this.requestTimeout + 500,
        "Drive yanıt vermedi. İnternet bağlantını kontrol edip yeniden dene. Yerel kayıtların korunuyor.",
        "NETWORK_TIMEOUT",
      );
      if (response.status === 401 && !retried) {
        this.token = null;
        this.expires = 0;
        await this.native.invalidateToken?.();
        return await this.request(path, options, silent, true);
      }
      if (!response.ok) {
        if (response.status === 401) {
          this.token = null;
          this.expires = 0;
        }
        let payload;
        try {
          payload = JSON.parse(response.text);
        } catch {}
        throw driveError(response.status, payload);
      }
      return response.status === 204
        ? null
        : new Response(response.text, {
            status: response.status,
            headers: response.headers,
          });
    } catch (e) {
      if (e.code) throw e;
      throw failure(
        "Drive’a ulaşılamadı. İnternet bağlantını kontrol et. Yerel kayıtların cihazda duruyor.",
        "NETWORK",
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  async profile(silent = false) {
    return (
      (
        await (
          await this.request(
            "drive/v3/about?fields=user(displayName,emailAddress)",
            {},
            silent,
          )
        ).json()
      ).user || {}
    );
  }
  async query(q, silent = false) {
    let files = [],
      pageToken;
    do {
      const params = new URLSearchParams({
        q,
        fields: "nextPageToken,files(id,name,createdTime)",
        pageSize: "1000",
        orderBy: "createdTime desc",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const d = await (
        await this.request("drive/v3/files?" + params, {}, silent)
      ).json();
      if (!Array.isArray(d.files))
        throw failure(
          "Drive yedek listesi beklenen biçimde değil. Yeniden dene.",
        );
      files.push(...d.files);
      pageToken = d.nextPageToken;
    } while (pageToken);
    return files;
  }
  async folder(silent = false) {
    const files = await this.query(
      "trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Kart Takip Yedekleri'",
      silent,
    );
    if (files.length) return files[0].id;
    const r = await this.request(
      "drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Kart Takip Yedekleri",
          mimeType: "application/vnd.google-apps.folder",
        }),
      },
      silent,
    );
    const folder = await r.json();
    if (!folder.id) throw failure("Drive yedek klasörü oluşturulamadı.");
    return folder.id;
  }
  async backup(text, silent = false) {
    const folder = await this.folder(silent),
      boundary = "kart_" + crypto.randomUUID();
    await this.request(
      "upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: this.filename(), parents: [folder], mimeType: "application/json" })}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--\r\n`,
      },
      silent,
    );
  }
  async list(silent = false) {
    const folders = await this.query(
      "trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Kart Takip Yedekleri'",
      silent,
    );
    const all = [];
    for (const f of folders)
      all.push(
        ...(await this.query(
          `trashed = false and '${f.id}' in parents and mimeType = 'application/json'`,
          silent,
        )),
      );
    return all.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  }
  async restore(id) {
    return (
      await this.request(
        "drive/v3/files/" + encodeURIComponent(id) + "?alt=media",
      )
    ).text();
  }
  async remove(id) {
    await this.request("drive/v3/files/" + encodeURIComponent(id), {
      method: "DELETE",
    });
  }
  async disconnect() {
    if (this.isNative)
      await withTimeout(
        this.native.disconnect(),
        30000,
        "Google yetkisi kaldırılamadı. İnternet bağlantını kontrol et.",
        "NETWORK_TIMEOUT",
      );
    this.token = null;
    this.expires = 0;
  }
}
