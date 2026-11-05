import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { createApp } from "../src/controller.js";
import { Drive, driveError } from "../src/drive.js";
import { parseAmount, shiftPeriod } from "../src/ui.js";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const fixture = () => ({
  cards: ["Deneme kartı"],
  statements: [
    {
      card: "Deneme kartı",
      year: "1997",
      month: "Şubat",
      amount: 1250.5,
      day: 21,
      isPaid: true,
    },
  ],
});
const memory = () => {
  const values = new Map();
  return {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => values.set(k, v),
  };
};
const tick = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};
async function setup(
  t,
  { adapter = memory(), drive = new Drive({}, false), ...options } = {},
) {
  const dom = new JSDOM(html, { url: "https://kart-takip.test" }),
    w = dom.window;
  w.scrollTo = () => {};
  w.matchMedia = () => Object.assign(new w.EventTarget(), { matches: false });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  const downloads = [],
    charts = [];
  class FakeChart {
    constructor(canvas, config) {
      charts.push(config);
    }
    destroy() {}
  }
  const app = await createApp({
    window: w,
    adapter,
    drive,
    Chart: FakeChart,
    now: () => new Date("2026-11-05T12:00:00Z"),
    download: async (text, name) => downloads.push({ text, name }),
    ...options,
  });
  t.after(() => {
    app.destroy();
    w.close();
  });
  const $ = (id) => w.document.getElementById(id),
    submit = (id) =>
      $(id).dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
  return { app, w, $, submit, adapter, downloads, charts };
}
async function addCard(c, name = "Deneme kartı") {
  c.w.document.querySelector("[data-action=add-card]").click();
  c.$("cardName").value = name;
  c.submit("cardForm");
  await tick();
}
async function addEntry(c, amount = "1.250,50", day = "21") {
  c.$("addEntryFab").click();
  c.$("amountInput").value = amount;
  c.$("dayInput").value = day;
  c.submit("entryForm");
  await tick();
}
test("UI: ilk açılış boş, modern beş ekran ve Drive opsiyonel", async (t) => {
  const c = await setup(t);
  assert.equal(c.w.document.querySelectorAll(".bottom-nav button").length, 5);
  assert.match(c.$("cardList").textContent, /Henüz kart eklenmedi/);
  assert.match(c.$("homeEntries").textContent, /Henüz bu ay kayıt yok/);
  assert.equal(c.$("totalDisplay").textContent, "₺0,00");
  assert.equal(c.$("driveBackup").disabled, true);
  assert.deepEqual(c.app.snapshot().data, { cards: [], statements: [] });
});
test("UI: kart ekle, ekstre ekle/güncelle, ödeme durumunu koru ve yeniden aç", async (t) => {
  const c = await setup(t);
  await addCard(c);
  assert.equal(c.$("cardDialog").open, false);
  await addEntry(c);
  assert.equal(c.app.snapshot().data.statements[0].amount, 1250.5);
  c.app.navigate("statements");
  c.$("entryList").querySelector(".paid-chip").click();
  await tick();
  assert.equal(c.app.snapshot().data.statements[0].isPaid, true);
  c.$("entryList").querySelector(".icon-button").click();
  c.$("amountInput").value = "2000,75";
  c.submit("entryForm");
  await tick();
  assert.equal(c.app.snapshot().data.statements.length, 1);
  assert.equal(c.app.snapshot().data.statements[0].isPaid, true);
  assert.equal(c.app.snapshot().data.statements[0].amount, 2000.75);
  const reopened = await setup(t, { adapter: c.adapter });
  assert.equal(reopened.app.snapshot().data.statements[0].amount, 2000.75);
});
test("UI: geçmiş v7 TXT, dinamik yıl, grafik ve mükerrer yükleme", async (t) => {
  const c = await setup(t);
  await c.app.processImport(JSON.stringify({ cc_tracker_v7: fixture() }));
  await c.app.processImport(JSON.stringify(fixture()));
  assert.equal(c.app.snapshot().data.statements.length, 1);
  c.$("yearSelect").value = "1997";
  c.$("yearSelect").dispatchEvent(new c.w.Event("change"));
  c.$("monthSelect").value = "Şubat";
  c.$("monthSelect").dispatchEvent(new c.w.Event("change"));
  c.app.navigate("history");
  assert.equal(c.charts.at(-1).data.datasets[0].data[1], 1250.5);
  assert.match(c.$("homeEntries").textContent, /1997/);
  await c.app.exportBackup();
  assert.deepEqual(JSON.parse(c.downloads[0].text), fixture());
  assert.match(c.downloads[0].name, /\.txt$/);
});
test("UI: çakışma seçimi, iptal ve değiştir onayı gerçek dialog akışından geçer", async (t) => {
  const c = await setup(t);
  await c.app.processImport(fixture());
  const incoming = fixture();
  incoming.statements[0].amount = 888;
  let p = c.app.processImport(incoming);
  await tick();
  assert.equal(c.$("conflictDialog").open, true);
  assert.match(c.$("existingValue").textContent, /1.250,50/);
  c.$("cancelImport").click();
  await p;
  assert.equal(c.app.snapshot().data.statements[0].amount, 1250.5);
  p = c.app.processImport(incoming);
  await tick();
  c.$("keepIncoming").click();
  await p;
  assert.equal(c.app.snapshot().data.statements[0].amount, 888);
  assert.equal(c.app.snapshot().safety.statements[0].amount, 1250.5);
  c.$("importMode").value = "replace";
  p = c.app.processImport({ cards: [], statements: [] });
  await tick();
  assert.equal(c.$("confirmDialog").open, true);
  c.$("confirmAccept").click();
  await p;
  assert.equal(c.app.snapshot().data.statements.length, 0);
  assert.equal(c.app.snapshot().safety.statements[0].amount, 888);
});
test("UI: bozuk JSON mevcut kayıtları değiştirmez ve hata görünür", async (t) => {
  const c = await setup(t);
  await c.app.processImport(fixture());
  await c.app.processImport("{bozuk");
  assert.deepEqual(c.app.snapshot().data, fixture());
  assert.equal(c.$("status").hidden, false);
  assert.match(c.$("status").textContent, /JSON/);
});
test("UI: Drive bağlantı hatası ekran içinde görünür, yerel işlemler sürer", async (t) => {
  const c = await setup(t);
  c.app.navigate("backup");
  c.$("driveConnect").click();
  await tick();
  assert.match(c.$("driveMessage").textContent, /Android APK/);
  assert.ok(c.$("driveMessage").classList.contains("error"));
  assert.equal(c.$("driveConnect").disabled, false);
  c.app.navigate("home");
  await addCard(c);
  await addEntry(c);
  assert.equal(c.app.snapshot().data.statements.length, 1);
});
test("UI: bağlantı beklerken ilerleme görünür ve başarıda hesap/Drive listesi açılır", async (t) => {
  let connect;
  const drive = {
    connect: () => new Promise((r) => (connect = r)),
    profile: async () => ({ emailAddress: "test@example.invalid" }),
    list: async () => [],
    filename: () => "test.json",
  };
  const c = await setup(t, { drive });
  c.$("driveConnect").click();
  await tick();
  assert.equal(c.$("driveConnect").disabled, true);
  assert.match(c.$("driveMessage").className, /busy/);
  connect();
  await tick();
  assert.equal(c.$("driveBackup").disabled, false);
  assert.match(c.$("driveAccount").textContent, /test@example.invalid/);
  assert.match(c.$("driveFiles").textContent, /henüz yedek yok/);
});
test("UI: Drive indirme bozuksa yerel veri aynı kalır", async (t) => {
  const drive = {
    connect: async () => {},
    profile: async () => ({}),
    list: async () => [
      { id: "bad", name: "bozuk.json", createdTime: "2026-11-05T12:00:00Z" },
    ],
    restore: async () => "{bad",
    filename: () => "test.json",
  };
  const c = await setup(t, { drive });
  await c.app.processImport(fixture());
  await c.app.connectDrive();
  c.$("driveFiles").querySelector("button").click();
  await tick();
  assert.deepEqual(c.app.snapshot().data, fixture());
  assert.match(c.$("driveMessage").textContent, /JSON/);
});
test("UI: tema seçimi veri kaybetmeden kalıcıdır; gezinme ve geri tuşu dialog kapatır", async (t) => {
  const c = await setup(t);
  await c.app.processImport(fixture());
  c.app.navigate("settings");
  c.w.document.querySelector("[data-theme-choice=light]").click();
  await tick();
  assert.equal(c.w.document.documentElement.dataset.theme, "light");
  const reopened = await setup(t, { adapter: c.adapter });
  assert.equal(reopened.w.document.documentElement.dataset.theme, "light");
  assert.deepEqual(reopened.app.snapshot().data, fixture());
  c.app.navigate("statements");
  await c.app.back();
  assert.equal(c.app.currentScreen, "home");
  c.$("addEntryFab").click();
  await c.app.back();
  assert.equal(c.$("entryDialog").open, false);
});
test("UI: kullanıcı HTML girişi metindir, çalıştırılabilir öğeye dönüşmez", async (t) => {
  const c = await setup(t);
  await addCard(c, "<img src=x onerror=alert(1)>");
  assert.equal(c.$("cardList").querySelectorAll("img").length, 0);
  assert.match(c.$("cardList").textContent, /<img/);
});
test("Türkçe tutar ve yıl sınırlarında ay geçişleri", () => {
  assert.equal(parseAmount("1.250,50"), 1250.5);
  assert.equal(parseAmount("-20,75"), -20.75);
  assert.throws(() => parseAmount("1,2,3"));
  assert.deepEqual(shiftPeriod("2026", "Ocak", -1), {
    year: "2025",
    month: "Aralık",
  });
  assert.equal(shiftPeriod("1", "Ocak", -1), null);
  assert.equal(shiftPeriod("9999", "Aralık", 1), null);
});
test("Drive HTTP hataları yapılandırma/kota/izin/ağ sorunlarını ayırt eder", () => {
  assert.equal(
    driveError(403, { error: { errors: [{ reason: "accessNotConfigured" }] } })
      .code,
    "CONFIGURATION",
  );
  assert.equal(
    driveError(403, { error: { errors: [{ reason: "storageQuotaExceeded" }] } })
      .code,
    "QUOTA",
  );
  assert.equal(driveError(401, {}).code, "AUTH_EXPIRED");
  assert.equal(driveError(429, {}).code, "RATE_LIMIT");
});
test("Drive: hesap seçimi takılırsa zaman aşımı ile hata döner, sonsuz beklemez", async () => {
  let cancelled = false;
  const drive = new Drive(
    {
      authorize: () => new Promise(() => {}),
      cancelAuthorization: async () => {
        cancelled = true;
      },
    },
    true,
    fetch,
    { authTimeout: 10 },
  );
  await assert.rejects(drive.connect(), (e) => e.code === "AUTH_TIMEOUT");
  assert.equal(cancelled, true);
  assert.equal(drive.authorizing, null);
});
test("Drive: 401 tokenı temizler ve yalnızca bir kez yeniden yetkilendirir", async () => {
  let auth = 0,
    clear = 0,
    requests = 0;
  const drive = new Drive(
    {
      authorize: async () => ({ token: "test-token-" + ++auth }),
      invalidateToken: async () => {
        clear++;
      },
    },
    true,
    async () =>
      ++requests === 1
        ? new Response("{}", { status: 401 })
        : Response.json({ files: [] }),
  );
  await drive.query("trashed=false");
  assert.equal(auth, 2);
  assert.equal(clear, 1);
  assert.equal(requests, 2);
});
test("Drive: yanıt vermeyen ağ zaman aşımıyla kullanıcıya bildirilir", async () => {
  const drive = new Drive(
    { authorize: async () => ({ token: "test-token" }) },
    true,
    () => new Promise(() => {}),
    { requestTimeout: 10 },
  );
  await assert.rejects(
    drive.query("trashed=false"),
    (e) => e.code === "NETWORK_TIMEOUT",
  );
});
test("UI: değiştirme onayından vazgeçilirse başarı gösterilmez ve veriler değişmez", async (t) => {
  const c = await setup(t);
  await c.app.processImport(fixture());
  c.$("importMode").value = "replace";
  const pending = c.app.processImport({ cards: [], statements: [] });
  await tick();
  c.$("confirmCancel").click();
  assert.equal(await pending, false);
  assert.deepEqual(c.app.snapshot().data, fixture());
});
test("UI: onaylı veri temizliği güvenlik kopyası ve otomatik yedeği tek yazımda siler", async (t) => {
  const c = await setup(t);
  await c.app.processImport(fixture());
  await c.app.processImport({ cards: ["İkinci"], statements: [] });
  c.app.navigate("settings");
  c.$("clearData").click();
  await tick();
  c.$("confirmAccept").click();
  await tick();
  assert.deepEqual(c.app.snapshot().data, { cards: [], statements: [] });
  assert.equal(c.app.snapshot().safety, null);
  assert.equal(c.app.snapshot().auto, false);
  assert.equal(c.app.snapshot().pending, false);
});
test("Drive: sessiz profil ve liste yenilemesi hesap seçim ekranı istemez", async () => {
  const flags = [];
  const drive = new Drive(
    {
      authorize: async (o) => {
        flags.push(o.silent);
        return { token: "test-token" };
      },
    },
    true,
    async (url) =>
      url.includes("about?")
        ? Response.json({ user: {} })
        : Response.json({ files: [] }),
  );
  await drive.profile(true);
  drive.token = null;
  await drive.list(true);
  assert.deepEqual(flags, [true, true]);
});
