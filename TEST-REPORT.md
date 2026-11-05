# Kart Takip 1.1 — test ve doğrulama raporu

Tarih: 5 Kasım 2026. Çalışma dalı: `feat/android-offline-drive`. main değiştirilmedi.

## Kullanıcı bildirimi ve Drive incelemesi

Bildirilen davranış: Yedekle/listele sonrasında hesap seçimi açılıyor, hesap seçilince görünür sonuç veya hata olmuyor.

Kodda doğrulanan eksikler: Sonuç mesajı uzun sayfanın üstündeydi; düğme altındayken görünmeyebiliyordu. Bağlı hesap/ilerleme göstergesi yoktu. Yetkilendirme sonucu MainActivity üstündeki geçici plugin alanına bağlıydı; hesap seçimi ve ağ isteği zaman aşımıyla sınırlandırılmıyordu. OAuth/API hata nedenleri kullanıcıya ayrı gösterilmiyordu. Sabit anahtar tanımlanmayan Actions APK’larında imza SHA-1’i değişebiliyordu.

Düzeltmeler: Capacitor saved ActivityCallback ve dışa kapalı GoogleAuthorizationActivity; native 120 saniye yetkilendirme sınırı; yaklaşık 30 saniye ağ sınırı; API üzerinden bağlantı doğrulama ve hesap bilgisi; bağlandıktan sonra otomatik listeleme; kalıcı ekran içi ilerleme/hata; 401 sonrası tek token yenilemesi; yapılandırma/izin/kota/ağ ayrımı; kurulu APK paket/SHA-1/Play services tanılaması; sessiz otomatik işlemlerde izin ekranı açmama. Tokenlar bellekte; bridge günlüklemesi kapalı.

**Gerçek cihazdaki Google hata kodu elde edilmedi. Kesin tek bir kök neden veya gerçek hesapta uçtan uca başarı doğrulanmış değildir.** Google Cloud paket/SHA-1 eşleşmesi kullanıcı tarafından tamamlanmalı ve cihazda test edilmelidir.

## Otomatik testler

`npm test`: **38 test, 38 başarılı**.

- Temiz depo, boş kart/ekstre ve varsayılan kapalı otomatik yedek.
- Kart ve ekstre ekleme, aynı dönemi güncelleme, ödeme durumunu koruma, yeniden açılış.
- Geçmiş/gelecek yıllar, ay sınırları ve yıllık toplamların ayrılığı.
- v7/v8 TXT/JSON, sarılı yapı, birleştirme/değiştirme/çakışma ve iptal; aynı yedek tekrarında çoğalmama.
- Bozuk/eksik/geçersiz tipli yedek reddi; başarısız yazımda önceki durumun korunması.
- Güvenlik kopyası, eşzamanlı metadata yazımı, tek işlemde yerel veri temizliği.
- jsdom içinde gerçek HTML olaylarıyla kart/ekstre formları, ödeme, düzenleme, dönemler, TXT dışa aktarma, tema kalıcılığı, ekran geçişi, geri tuşu, değiştirme onayından vazgeçme ve HTML girişlerinin güvenli gösterilmesi.
- Drive bekleme/success/error durumlarının UI’da gösterilmesi; hata sonrası yerel kullanıma devam; bozuk Drive indirmesinde veriyi koruma.
- Taklit HTTP servisiyle Drive yükleme/indirme/silme/sayfalı listeleme, 401 yenileme, yapılandırma/kota hataları, hesap/ağ zaman aşımı ve sessiz profil/liste yenilemesi.

Google sunucusuna bu testlerde istek gönderilmez. DOM testleri Chart adaptörünü taklit eder; gerçek grafik ayrıca tarayıcıda görüldü.

## Gerçek Chrome kontrolü

Mevcut Chrome bağlantısı kullanıldı; ikinci Playwright kurulumu yapılmadı. Sentetik, yalnızca yerel tarayıcı deposunda tutulan deneme kaydı kullanıldı; APK’ya konmadı.

- Boş açılış, mobil kart ekleme, Türkçe `1.250,50` tutar kaydı, ödeme işaretleme ve sayfa yeniden açılışında kalıcılık doğrulandı.
- Geçmiş ekranında Chart.js gerçek 12 aylık grafiği çizdi.
- Web önizlemede Drive’ın APK gerektirdiği açık, kalıcı hata mesajıyla görüldü; yerel kayıtlar çalışmaya devam etti.
- Koyu/açık tema ve masaüstü/390 px telefon görünümü incelendi.
- 320 px görünümde beş ekranın tamamında `scrollWidth === clientWidth`: yatay taşma yok.
- Tarayıcı konsolunda kontrol sırasında hata yoktu.
- Yerel önizleme görüntüsü: `artifacts/yeni-arayuz-mobil.png` (test kaydı içerir, Git/APK içinde değildir).

## Yerel Android derlemesi

`npm run sync` ve `:app:clean :app:assembleDebug :app:lintDebug`: **BUILD SUCCESSFUL**. Android lint hata vermedi; şablon/bağımlılık güncelliği ve ikon biçimi gibi uyarılar engelleyici değildir.

APK: `artifacts/Kart-Takip-1.1-debug.apk`.

$15.146.156 bayt** (yaklaşık 4,91 MiB).

SHA-256: `F6CAD9009DEAE699AA01A5428A5E4255792EF1B6F2DA0F3CE9820FAFE7E2273C`.

İmza `apksigner verify --print-certs` ile doğrulandı. Yerel APK SHA-1’i: `9F:BE:BA:F3:C6:77:3F:B8:EB:C5:92:C5:48:6D:F9:72:6D:FE:B0:51`. Bu değer yalnızca bu anahtarla üretilen APK içindir; Actions APK’sı için kendi tanılama/imza çıktısı kullanılmalıdır.

Web asset izin listesi arşivde kontrol edildi: app.js, app.css, index.html, icon-512.png, manifest.json, sw.js ve boş Cordova dosyaları. Beklenmeyen dosya veya sentetik test kaydı yok. Paket kimliği aynı; versionCode 2 / versionName 1.1. Android 7.0 / API 24+; hedef 36. İzinler INTERNET ve AndroidX’in uygulamaya özel imza seviyeli dahili receiver iznidir; depolama/konum/kamera/rehber izni yok.

## Cihazda ayrıca denenmesi gerekenler

- Gerçek Google hesabıyla seçim dönüşü, API yetkisi, Drive’a gerçek yükleme/listeleme/geri yükleme/silme ve yetki iptali.
- Android’in gerçek dosya seçicisi ve kaydetme paneli; fiziksel klavye/geri tuşu/sistem çubukları, süreç öldürülmesi ve üreticiye özgü davranışlar.
- Aynı imzayla önceki APK üzerine güncelleme ve gerçek çevrimdışı cihaz kullanımı.
- Kullanıcıya ait release anahtarıyla imzalı release derlemesi.

Cihaza APK kurulmadı veya cihazdaki kullanıcı verisi değiştirilmedi. Otomatik yedek yalnızca uygulama açık/yeniden etkin olduğunda güvenilir şekilde denenir; kapalı uygulamada arka plan garantisi verilmez.

