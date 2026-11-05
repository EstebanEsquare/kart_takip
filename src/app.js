import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import Chart from "chart.js/auto";
import { createApp } from "./controller.js";
import { Drive } from "./drive.js";
const Native = registerPlugin("KartNative"),
  native = Capacitor.isNativePlatform();
const adapter = native
  ? {
      get: async () => (await Native.readState()).value ?? null,
      set: async (key, value) => Native.writeState({ value }),
    }
  : {
      get: async (key) => localStorage.getItem(key),
      set: async (key, value) => localStorage.setItem(key, value),
    };
async function main() {
  const app = await createApp({
    window,
    adapter,
    drive: new Drive(Native, native),
    nativeApi: native
      ? {
          ...Native,
          readBackup: () => Native.readBackup(),
          writeBackup: (args) => Native.writeBackup(args),
          diagnostics: () => Native.diagnostics(),
          exitApp: () => App.exitApp(),
        }
      : null,
    Chart,
    onTheme: (light) => {
      if (native) Native.setSystemTheme({ light }).catch(() => {});
    },
  });
  if (native) {
    await App.addListener("backButton", () => app.back());
    await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) app.resume();
    });
    await App.addListener("appRestoredResult", (result) => {
      if (result.pluginId === "KartNative") {
        app.navigate("backup");
        document.getElementById("driveMessage").textContent =
          "Android, hesap veya dosya seçimi sırasında uygulamayı yeniden başlattı. Yerel kayıtlar korunuyor. Bağlantı veya dosya seçimi işlemini yeniden başlat.";
      }
    });
  } else if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
main().catch(() => {
  document.getElementById("fatalError").hidden = false;
  document.getElementById("fatalError").textContent =
    "Uygulama başlatılamadı. Yeniden açmayı deneyin.";
});
