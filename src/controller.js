import {
  Store,
  validate,
  merge,
  upsert,
  months,
  totals,
  empty,
} from "./data.js";
import { createUI, money, parseAmount, periodRows, shiftPeriod } from "./ui.js";
const pages = {
  home: ["GENEL BAKIŞ", "Finansına bir bakış."],
  statements: ["AYLIK TAKİP", "Ekstrelerin, bir arada."],
  history: ["GEÇMİŞ VE ANALİZ", "Her dönemi hatırla."],
  backup: ["YEDEKLEME", "Kayıtların yanında."],
  settings: ["TERCİHLER", "Sana göre Kart Takip."],
};
export async function createApp({
  window: w,
  adapter,
  drive,
  nativeApi = null,
  Chart = null,
  now = () => new Date(),
  download = null,
  onTheme = null,
}) {
  const d = w.document,
    $ = (id) => d.getElementById(id),
    ui = createUI(d),
    store = new Store(adapter);
  let db = empty(),
    ready = false,
    busy = false,
    driveBusy = false,
    screen = "home",
    filter = "all",
    chart,
    timer,
    toastTimer,
    year = String(now().getFullYear()),
    month = months[now().getMonth()],
    returnToEntry = false,
    connected = false,
    account = "",
    destroyed = false;
  const listeners = [];
  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  };
  function notify(message, isError = false) {
    clearTimeout(toastTimer);
    $("status").textContent = message;
    $("status").classList.toggle("error", isError);
    $("status").hidden = false;
    toastTimer = setTimeout(
      () => ($("status").hidden = true),
      isError ? 12000 : 5000,
    );
  }
  const friendly = (e) =>
    e instanceof SyntaxError
      ? "Yedek metni geçerli JSON değil. Dosyanın tamamını seçtiğinden emin ol."
      : e?.message || "İşlem tamamlanamadı. Yeniden deneyin.";
  function driveMessage(message, type = "") {
    const box = $("driveMessage");
    box.textContent = message;
    box.className = "drive-message " + type;
  }
  function updateDrive() {
    $("driveBadge").textContent = driveBusy
      ? "İşlem sürüyor"
      : connected
        ? "Bağlı"
        : "Bağlı değil";
    $("driveBadge").classList.toggle("connected", connected && !driveBusy);
    $("driveConnect").disabled = driveBusy;
    $("driveConnect").textContent = connected
      ? "Bağlantıyı yenile"
      : "Google Drive’a bağlan";
    for (const id of ["driveBackup", "driveList"])
      $(id).disabled = driveBusy || !connected;
    $("driveDisconnect").disabled = driveBusy || !store.state.driveLinked;
    $("driveAccount").hidden = !account;
    $("driveAccount").textContent = account;
    $("lastBackup").textContent = store.state.lastBackup
      ? "Son başarılı yedek: " +
        new Date(store.state.lastBackup).toLocaleString("tr-TR")
      : "Henüz başarılı Drive yedeği yok.";
    $("autoBackup").checked = !!store.state.auto;
    for (const button of $("driveFiles").querySelectorAll("button"))
      button.disabled = driveBusy;
  }
  function theme(choice = store.state.theme || "dark") {
    const dark =
      choice === "system"
        ? !!w.matchMedia?.("(prefers-color-scheme: dark)").matches
        : choice !== "light";
    d.documentElement.dataset.theme = dark ? "dark" : "light";
    for (const b of d.querySelectorAll("[data-theme-choice]"))
      b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice));
    d.querySelector("meta[name=theme-color]").content = dark
      ? "#10191d"
      : "#f2f5f0";
    onTheme?.(!dark);
    renderChart();
  }
  function renderChart() {
    if (screen !== "history" || !Chart) return;
    const values = totals(db, year),
      light = d.documentElement.dataset.theme === "light";
    const config = {
      type: "bar",
      data: {
        labels: months.map((m) => m.slice(0, 3)),
        datasets: [
          {
            label: "Ekstre toplamı (TL)",
            data: values,
            backgroundColor: values.map((_, i) =>
              months[i] === month
                ? light
                  ? "#25664a"
                  : "#b6efd5"
                : light
                  ? "#b7cfbf"
                  : "#365449",
            ),
            borderRadius: 5,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: {
            grid: { color: light ? "#e2e8e2" : "#2b3b42" },
            ticks: { color: light ? "#5e7167" : "#9cafa9", font: { size: 10 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: light ? "#5e7167" : "#9cafa9", font: { size: 10 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } },
        },
      },
    };
    if (chart) chart.destroy();
    chart = new Chart($("yearlyBarChart"), config);
  }
  function render() {
    const rows = periodRows(db, year, month),
      paid = rows.filter((s) => s.isPaid),
      pending = rows.filter((s) => !s.isPaid),
      total = rows.reduce((v, s) => v + s.amount, 0),
      paidTotal = paid.reduce((v, s) => v + s.amount, 0);
    $("yearSelect").value = year;
    $("monthSelect").value = month;
    $("periodLabel").textContent = month + " " + year;
    $("knownYears").replaceChildren(
      ...[
        ...new Set([
          year,
          String(now().getFullYear()),
          ...db.statements.map((s) => s.year),
        ]),
      ]
        .sort((a, b) => Number(a) - Number(b))
        .map((y) => new w.Option(y, y)),
    );
    $("totalDisplay").textContent = money(total);
    $("paidAmount").textContent = money(paidTotal);
    $("pendingAmount").textContent = money(total - paidTotal);
    $("paidCount").textContent = paid.length + " ekstre";
    $("pendingCount").textContent = pending.length + " ekstre";
    $("paidProgress").style.width =
      (rows.length ? (paid.length / rows.length) * 100 : 0) + "%";
    const same =
        year === String(now().getFullYear()) &&
        month === months[now().getMonth()],
      next =
        (same ? pending.find((s) => s.day >= now().getDate()) : pending[0]) ||
        pending[0];
    $("nextDay").textContent = next
      ? `${next.day} ${month} · ${next.card}`
      : "Bekleyen ekstre yok";
    const actions = {
      edit: openEntry,
      toggle: togglePaid,
      add: () => openEntry(),
    };
    ui.entries($("homeEntries"), rows.slice(0, 3), actions);
    ui.entries(
      $("entryList"),
      rows.filter(
        (s) => filter === "all" || (filter === "paid" ? s.isPaid : !s.isPaid),
      ),
      { ...actions, filtered: filter !== "all" },
    );
    ui.cards($("cardList"), db, rows, openCard, openEntry);
    $("entryCount").textContent = rows.length + " ekstre · " + money(total);
    $("chartTitle").textContent = year + " harcama seyri";
    $("yearTotal").textContent = money(
      totals(db, year).reduce((a, b) => a + b, 0),
    );
    ui.monthTiles($("monthOverview"), db, year, month, (m) => {
      month = m;
      render();
      navigate("statements");
    });
    const selected = $("cardSelect").value;
    $("cardSelect").replaceChildren(...db.cards.map((c) => new w.Option(c, c)));
    if (db.cards.includes(selected)) $("cardSelect").value = selected;
    for (const b of d.querySelectorAll("[data-filter]"))
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
    $("previousMonth").disabled = !shiftPeriod(year, month, -1);
    $("nextMonth").disabled = !shiftPeriod(year, month, 1);
    $("restoreSafety").disabled = !store.state.safety;
    updateDrive();
    renderChart();
  }
  function navigate(page) {
    if (!pages[page]) return;
    screen = page;
    for (const el of d.querySelectorAll(".screen"))
      el.hidden = el.id !== "screen-" + page;
    for (const b of d.querySelectorAll(".bottom-nav [data-go]")) {
      if (b.dataset.go === page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    [$("pageEyebrow").textContent, $("pageTitle").textContent] = pages[page];
    d.querySelector(".period-bar").hidden = ["backup", "settings"].includes(
      page,
    );
    $("addEntryFab").hidden = !["home", "statements"].includes(page);
    w.scrollTo?.({ top: 0 });
    renderChart();
  }
  function close(id) {
    $(id).close();
  }
  function openCard() {
    if (!ready || busy) return;
    returnToEntry = $("entryDialog").open;
    if (returnToEntry) close("entryDialog");
    $("cardName").value = "";
    $("cardError").textContent = "";
    $("cardDialog").showModal();
    $("cardName").focus();
  }
  function openEntry(entry = null, card = null) {
    if (!ready || busy) return;
    if (!db.cards.length) {
      returnToEntry = true;
      $("cardName").value = "";
      $("cardError").textContent = "";
      $("cardDialog").showModal();
      return;
    }
    $("entryForm").reset();
    $("entryError").textContent = "";
    $("entryPeriod").textContent =
      month.toLocaleUpperCase("tr-TR") + " " + year;
    $("entryDialogTitle").textContent = entry
      ? "Ekstreyi düzenle"
      : "Yeni ekstre";
    if (card || entry) $("cardSelect").value = card || entry.card;
    if (entry) {
      $("amountInput").value = String(entry.amount).replace(".", ",");
      $("dayInput").value = entry.day;
    }
    $("entryDialog").showModal();
  }
  function ask(title, text, label = "Devam et", danger = false) {
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmAccept").textContent = label;
    $("confirmAccept").className = "button " + (danger ? "danger" : "primary");
    const dialog = $("confirmDialog");
    return new Promise((resolve) => {
      const end = (value) => {
        cleanup();
        dialog.close();
        resolve(value);
      };
      const cancel = (e) => {
        e.preventDefault();
        end(false);
      };
      const yes = () => end(true),
        no = () => end(false);
      function cleanup() {
        $("confirmAccept").removeEventListener("click", yes);
        $("confirmCancel").removeEventListener("click", no);
        dialog.removeEventListener("cancel", cancel);
      }
      $("confirmAccept").addEventListener("click", yes);
      $("confirmCancel").addEventListener("click", no);
      dialog.addEventListener("cancel", cancel);
      dialog.showModal();
    });
  }
  function conflict(a, b) {
    $("conflictLabel").textContent = `${a.card} · ${a.month} ${a.year}`;
    const format = (s) =>
      `${money(s.amount)}\nGün: ${s.day}\n${s.isPaid ? "Ödendi" : "Bekliyor"}`;
    $("existingValue").textContent = format(a);
    $("incomingValue").textContent = format(b);
    const dialog = $("conflictDialog");
    return new Promise((resolve) => {
      const end = (value) => {
        cleanup();
        dialog.close();
        resolve(value);
      };
      const existing = () => end("existing"),
        incoming = () => end("incoming"),
        no = () => end("cancel"),
        cancel = (e) => {
          e.preventDefault();
          no();
        };
      function cleanup() {
        $("keepExisting").removeEventListener("click", existing);
        $("keepIncoming").removeEventListener("click", incoming);
        $("cancelImport").removeEventListener("click", no);
        dialog.removeEventListener("cancel", cancel);
      }
      $("keepExisting").addEventListener("click", existing);
      $("keepIncoming").addEventListener("click", incoming);
      $("cancelImport").addEventListener("click", no);
      dialog.addEventListener("cancel", cancel);
      dialog.showModal();
    });
  }
  async function mutate(fn, errorTarget = null) {
    if (!ready || busy) return false;
    busy = true;
    for (const b of d.querySelectorAll("form button[type=submit]"))
      b.disabled = true;
    try {
      const result = await fn();
      return result !== false;
    } catch (e) {
      const message = friendly(e);
      if (errorTarget) $(errorTarget).textContent = message;
      notify(message, true);
      return false;
    } finally {
      busy = false;
      for (const b of d.querySelectorAll("form button[type=submit]"))
        b.disabled = false;
      updateDrive();
    }
  }
  async function commit(data, options) {
    db = await store.commit(data, options);
    render();
    schedule();
  }
  async function togglePaid(s) {
    await mutate(async () => {
      const next = structuredClone(db),
        row = next.statements.find(
          (v) => v.card === s.card && v.year === s.year && v.month === s.month,
        );
      row.isPaid = !row.isPaid;
      await commit(next);
      notify(
        row.isPaid
          ? "Ekstre ödendi olarak işaretlendi."
          : "Ekstre yeniden bekleyenlere alındı.",
      );
    });
  }
  async function processImport(raw) {
    return mutate(async () => {
      const incoming = validate(raw);
      let next;
      if ($("importMode").value === "replace") {
        if (
          !(await ask(
            "Veriler değiştirilsin mi?",
            "Mevcut kart ve ekstreler bu yedekle değiştirilecek. Önceki veriler güvenlik kopyasında saklanır.",
            "Verileri değiştir",
          ))
        )
          return false;
        next = incoming;
      } else next = await merge(db, incoming, conflict);
      await commit(next, { safety: true });
      const message = `${incoming.cards.length} kart ve ${incoming.statements.length} ekstre okundu. Toplam ${db.cards.length} kart, ${db.statements.length} ekstre hazır.`;
      $("importResult").textContent = message;
      $("importResult").hidden = false;
      notify("Yedek güvenle yüklendi.");
    });
  }
  async function exportBackup() {
    if (!ready) return;
    try {
      const text = JSON.stringify(db),
        name = drive.filename().replace(".json", ".txt");
      if (nativeApi) await nativeApi.writeBackup({ text, name });
      else if (download) await download(text, name);
      else {
        const a = d.createElement("a"),
          url = w.URL.createObjectURL(
            new w.Blob([text], { type: "text/plain;charset=utf-8" }),
          );
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => w.URL.revokeObjectURL(url), 1000);
      }
      notify("TXT yedeği kaydedildi.");
    } catch (e) {
      notify(friendly(e), true);
    }
  }
  async function driveTask(message, fn) {
    if (!ready || driveBusy) return false;
    driveBusy = true;
    driveMessage(message, "busy");
    updateDrive();
    try {
      const result = await fn();
      return result !== false;
    } catch (e) {
      if (
        [
          "AUTH_REQUIRED",
          "AUTH_EXPIRED",
          "AUTH_TIMEOUT",
          "AUTH_CANCELLED",
          "CONFIGURATION",
        ].includes(e.code)
      ) {
        connected = false;
        account = "";
      }
      driveMessage(friendly(e), "error");
      notify(friendly(e), true);
      return false;
    } finally {
      driveBusy = false;
      updateDrive();
    }
  }
  async function refreshFiles(silent = false) {
    const files = await drive.list(silent);
    ui.driveFiles($("driveFiles"), files, restoreDrive, deleteDrive);
    return files;
  }
  async function connectDrive(silent = false) {
    return driveTask(
      silent
        ? "Google bağlantısı kontrol ediliyor…"
        : "Google hesabı bekleniyor…",
      async () => {
        await drive.connect(silent);
        const profile = await drive.profile(silent);
        connected = true;
        account = profile.emailAddress || profile.displayName || "";
        await store.metadata({ driveLinked: true });
        driveMessage("Bağlantı kuruldu. Yedekler getiriliyor…", "busy");
        const files = await refreshFiles(silent);
        driveMessage(
          files.length
            ? `${files.length} yedek bulundu. Yeni yedek oluşturabilir veya kayıtlarını geri yükleyebilirsin.`
            : "Google Drive bağlantısı hazır. İlk yedeğini şimdi oluşturabilirsin.",
        );
        schedule();
      },
    );
  }
  async function backupDrive(automatic = false) {
    if (
      automatic &&
      (!store.state.auto || !store.state.pending || !store.state.driveLinked)
    )
      return;
    if (!connected && !automatic) {
      driveMessage(
        "Önce Google Drive’a bağlan. Yerel kayıtların bu işlemden etkilenmez.",
        "error",
      );
      return;
    }
    const revision = store.state.revision;
    await driveTask("Yedek Google Drive’a yükleniyor…", async () => {
      await drive.backup(JSON.stringify(db), automatic);
      await store.metadata((state) => ({
        lastBackup: now().toISOString(),
        pending: state.revision !== revision,
      }));
      connected = true;
      driveMessage("Yedeğin Google Drive’a kaydedildi.");
      notify("Drive yedeği hazır.");
      await refreshFiles(automatic);
    });
    if (store.state.revision !== revision) schedule();
  }
  async function listDrive() {
    if (!connected) return;
    await driveTask("Drive yedekleri getiriliyor…", async () => {
      const files = await refreshFiles();
      driveMessage(
        files.length
          ? `${files.length} yedek bulundu. Geri yüklemede aşağıdaki aktarım yöntemi kullanılır.`
          : "Drive’da henüz yedek yok. Şimdi yedekleyerek ilk kopyanı oluşturabilirsin.",
      );
    });
  }
  async function restoreDrive(file) {
    if (busy) return;
    await driveTask("Yedek indiriliyor ve doğrulanıyor…", async () => {
      const text = await drive.restore(file.id);
      validate(text);
      const done = await processImport(text);
      driveMessage(
        done
          ? "Yedek aktarımı tamamlandı. Sonucu dosyayla yedekleme bölümünde görebilirsin."
          : "Aktarım uygulanmadı. Mevcut kayıtların korunuyor.",
      );
    });
  }
  async function deleteDrive(file) {
    if (
      driveBusy ||
      !(await ask(
        "Drive yedeği silinsin mi?",
        file.name +
          " Google Drive’dan kalıcı olarak silinecek. Cihazdaki kayıtlar değişmez.",
        "Yedeği sil",
        true,
      ))
    )
      return;
    await driveTask("Drive yedeği siliniyor…", async () => {
      await drive.remove(file.id);
      await refreshFiles();
      driveMessage("Seçilen Drive yedeği silindi.");
    });
  }
  async function disconnectDrive() {
    await driveTask("Google Drive bağlantısı kaldırılıyor…", async () => {
      await drive.disconnect();
      connected = false;
      account = "";
      await store.metadata({ auto: false, driveLinked: false });
      clearTimeout(timer);
      $("driveFiles").replaceChildren();
      driveMessage(
        "Google Drive bağlantısı kaldırıldı. Yerel kayıtların cihazında duruyor.",
      );
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (
      !destroyed &&
      store.state.auto &&
      store.state.pending &&
      store.state.driveLinked
    )
      timer = setTimeout(() => {
        if (w.navigator.onLine && !busy) backupDrive(true);
        else if (busy) schedule();
      }, 30000);
  }
  async function diagnose() {
    try {
      const info = nativeApi
        ? await nativeApi.diagnostics()
        : {
            packageName: "Web önizleme",
            sha1: "APK içinde gösterilir",
            googlePlayServices: "Android APK gerekir",
            version: "1.1",
          };
      $("diagnostics").textContent =
        `Paket: ${info.packageName}\nSürüm: ${info.version}\nSHA-1: ${info.sha1}\nGoogle Play services: ${info.googlePlayServices}\nOAuth türü: Android\nKapsam: drive.file\n\nGoogle Cloud’da bu paket ve SHA-1 ile Android istemcisi oluştur. Debug ve release imzaları farklıdır.`;
      $("diagnostics").hidden = false;
    } catch (e) {
      notify(friendly(e), true);
    }
  }
  // Tüm kullanıcı etkileşimleri tek yerde bağlanır; kayıtlardan HTML/onclick üretilmez.
  on(d, "click", (e) => {
    const go = e.target.closest("[data-go]"),
      action = e.target.closest("[data-action]"),
      dismiss = e.target.closest("[data-close]"),
      filterButton = e.target.closest("[data-filter]"),
      themeButton = e.target.closest("[data-theme-choice]");
    if (go) navigate(go.dataset.go);
    if (action) {
      if (action.dataset.action === "add-card") openCard();
      else openEntry();
    }
    if (dismiss) close(dismiss.dataset.close);
    if (filterButton) {
      filter = filterButton.dataset.filter;
      render();
    }
    if (themeButton)
      mutate(async () => {
        await store.metadata({ theme: themeButton.dataset.themeChoice });
        theme();
      });
  });
  on(d.querySelector(".brand"), "click", (e) => {
    e.preventDefault();
    navigate("home");
  });
  on($("addEntryFab"), "click", () => openEntry());
  for (const id of ["monthSelect", "yearSelect"])
    on($(id), "change", () => {
      const candidate = $("yearSelect").value;
      if (!/^[1-9]\d{0,3}$/.test(candidate)) {
        notify("1–9999 arasında bir yıl girin.", true);
        $("yearSelect").value = year;
        return;
      }
      year = candidate;
      month = $("monthSelect").value;
      render();
    });
  on($("previousMonth"), "click", () => {
    const p = shiftPeriod(year, month, -1);
    if (p) {
      ({ year, month } = p);
      render();
    }
  });
  on($("nextMonth"), "click", () => {
    const p = shiftPeriod(year, month, 1);
    if (p) {
      ({ year, month } = p);
      render();
    }
  });
  on($("cardForm"), "submit", async (e) => {
    e.preventDefault();
    $("cardError").textContent = "";
    const done = await mutate(async () => {
      const name = $("cardName").value.trim();
      if (!name || db.cards.includes(name))
        throw Error("Boş veya mevcut bir kart adı kullanılamaz.");
      const next = structuredClone(db);
      next.cards.push(name);
      await commit(next);
      $("cardSelect").value = name;
      close("cardDialog");
      notify("Kart eklendi.");
    }, "cardError");
    if (done && returnToEntry) {
      returnToEntry = false;
      openEntry(null, $("cardSelect").value);
    }
  });
  on($("cardDialog"), "cancel", () => {
    returnToEntry = false;
  });
  on($("entryForm"), "submit", (e) => {
    e.preventDefault();
    $("entryError").textContent = "";
    mutate(async () => {
      const card = $("cardSelect").value,
        amount = parseAmount($("amountInput").value),
        day = Number($("dayInput").value);
      if (!Number.isInteger(day) || day < 1 || day > 31)
        throw Error("Günü 1–31 arasında girin.");
      await commit(
        upsert(db, { card, amount, day, year, month, isPaid: false }),
      );
      close("entryDialog");
      notify("Ekstre kaydedildi.");
    }, "entryError");
  });
  on($("exportBackup"), "click", exportBackup);
  on($("importText"), "click", () => processImport($("importArea").value));
  on($("chooseBackup"), "click", async () => {
    if (!ready || busy) return;
    if (!nativeApi) {
      $("importFile").click();
      return;
    }
    try {
      await processImport((await nativeApi.readBackup()).text);
    } catch (e) {
      notify(friendly(e), true);
    }
  });
  on($("importFile"), "change", async (e) => {
    const file = e.target.files?.[0];
    try {
      if (file) {
        if (file.size > 20 * 1024 * 1024)
          throw Error("Dosya 20 MB sınırını aşıyor.");
        await processImport(await file.text());
      }
    } catch (err) {
      notify(friendly(err), true);
    } finally {
      e.target.value = "";
    }
  });
  on($("importMode"), "change", () => {
    $("importHint").textContent =
      $("importMode").value === "merge"
        ? "Mevcut kayıtlar korunur. Farklı değerler için seçim yaparsın."
        : "Mevcut verilerin yerine seçtiğin yedek yüklenir. Önce onay istenir.";
  });
  on($("restoreSafety"), "click", () =>
    mutate(async () => {
      if (!store.state.safety)
        throw Error("Henüz aktarım öncesi güvenlik kopyası yok.");
      if (
        await ask(
          "Güvenlik kopyasına dönülsün mü?",
          "Son aktarım öncesindeki kart ve ekstreler geri yüklenecek.",
          "Geri yükle",
        )
      ) {
        await commit(store.state.safety, { safety: true });
        notify("Güvenlik kopyası geri yüklendi.");
      }
    }),
  );
  on($("clearData"), "click", () =>
    mutate(async () => {
      if (
        await ask(
          "Tüm yerel veriler silinsin mi?",
          "Kartlar, ekstreler ve aktarım güvenlik kopyası silinir. Bu işlemi geri alamazsın. Drive’daki yedekler korunur.",
          "Tümünü sil",
          true,
        )
      ) {
        db = await store.commit(empty(), { reset: true });
        clearTimeout(timer);
        render();
        notify("Yerel kayıtlar silindi.");
      }
    }),
  );
  on($("driveConnect"), "click", () => connectDrive());
  on($("driveBackup"), "click", () => backupDrive());
  on($("driveList"), "click", listDrive);
  on($("driveDisconnect"), "click", disconnectDrive);
  on($("diagnose"), "click", diagnose);
  on($("autoBackup"), "change", () =>
    mutate(async () => {
      if ($("autoBackup").checked && !store.state.driveLinked) {
        $("autoBackup").checked = false;
        throw Error(
          "Otomatik yedekleme için önce Yedek ekranından Google Drive’a bağlan.",
        );
      }
      await store.metadata({ auto: $("autoBackup").checked });
      schedule();
      notify(
        store.state.auto
          ? "Otomatik Drive yedeği açıldı."
          : "Otomatik Drive yedeği kapatıldı.",
      );
    }),
  );
  on(w, "online", schedule);
  const media = w.matchMedia?.("(prefers-color-scheme: dark)");
  if (media?.addEventListener)
    on(media, "change", () => {
      if (store.state.theme === "system") theme();
    });
  async function back() {
    const modal = [...d.querySelectorAll("dialog[open]")].at(-1);
    if (modal) {
      const event = new w.Event("cancel", { cancelable: true });
      if (modal.dispatchEvent(event)) modal.close();
      return;
    }
    if (screen !== "home") {
      navigate("home");
      return;
    }
    if (
      await ask(
        "Kart Takip kapatılsın mı?",
        "Kaydedilmiş verilerin cihazda korunur.",
        "Kapat",
      )
    )
      await nativeApi?.exitApp?.();
  }
  try {
    db = await store.load();
    if (!(await adapter.get("kart_takip_state_v1"))) {
      const legacy =
        w.localStorage.getItem("cc_tracker_v8") ??
        w.localStorage.getItem("cc_tracker_v7");
      if (legacy) db = await store.commit(validate(legacy));
    }
    $("monthSelect").replaceChildren(...months.map((m) => new w.Option(m, m)));
    ready = true;
    render();
    theme();
    if (store.state.driveLinked && w.navigator.onLine) connectDrive(true);
    schedule();
  } catch (e) {
    $("fatalError").textContent =
      "Kayıtlar açılamadı. Üzerlerine yazılmadı. Uygulamayı yeniden aç veya depolama alanını kontrol et. " +
      friendly(e);
    $("fatalError").hidden = false;
    for (const b of d.querySelectorAll("button,input,select,textarea"))
      b.disabled = true;
  }
  return {
    back,
    navigate,
    processImport,
    exportBackup,
    connectDrive,
    backupDrive,
    listDrive,
    diagnose,
    resume: () => {
      if (
        store.state.driveLinked &&
        !connected &&
        !driveBusy &&
        w.navigator.onLine
      )
        connectDrive(true);
      schedule();
    },
    snapshot: () => structuredClone(store.state),
    get currentScreen() {
      return screen;
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      clearTimeout(toastTimer);
      chart?.destroy();
      listeners.forEach((remove) => remove());
    },
  };
}
