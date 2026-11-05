# Test ve derleme raporu — 5 Kasım 2026

## Doğrulananlar

- `npm test`: **19/19 başarılı**. Temiz depo, kart/ekstre, ödeme korunması, yeniden açılış, 1997 ve gelecek yıllar, v7/v8 TXT, aynı yedeğin tekrar yüklenmesi, birleştirme, değiştirme, çakışmada karar/iptal, güvenlik kopyası, bozuk dosya, yazma hatası, eşzamanlı ayar yazımı, negatif ekstre (alacak) ve Drive ağ hatasında yerel verinin korunması.
- Drive HTTP istemcisinin klasör/yükleme/indirme/silme ve sayfalı tarih sıralı listeleme protokolü **taklit servisle** test edildi. Bu, gerçek Google hesabı testi değildir.
- `npm run sync`: başarılı; Chart.js harici CDN olmadan `app.js` içinde paketlendi.
- `:app:assembleDebug :app:lintDebug`: **BUILD SUCCESSFUL**. Lint hata yok; şablon/kütüphane sürümü/ikon biçimiyle ilgili uyarılar mevcut. Toplu bağımlılık güncellemesi yapılmadı.
- APK gerçekten oluştu; Android `apksigner verify --print-certs` doğrulaması geçti.
- AAPT: ad **Kart Takip**, paket **com.estebanesquare.karttakip**, minimum API **24**, hedef API **36**. INTERNET ve AndroidX'in uygulamaya özel imza seviyeli dahili receiver izni dışında izin yok. Depolama, kamera, rehber veya konum izni yok.
- APK arşivindeki web varlıkları izin listesiyle kontrol edildi: app.js, index.html, icon-512.png, manifest.json, sw.js ve boş Cordova uyumluluk dosyaları. Kullanıcı yedeği / test fixture pakette yok.
- Chrome yerel önizlemede boş kart listesi, **TOPLAM: 0,00 TL**, yıl/ay ve grafik alanıyla açıldı. Uygulama açılış durumu **Veriler cihazda saklanır** olarak görüldü.

## APK

Yerel teslim: `artifacts/Kart-Takip-debug.apk` (Git'e eklenmez).

Temiz derleme boyutu: 9.275.488 bayt (yaklaşık 8,85 MiB).

SHA-256: `EEDE0B51061CF9867DD4A1988D2CE0D7D48A50DA9104344E350117F3D939A46E`

Bu yerel debug APK imzasının SHA-1'i: `9F:BE:BA:F3:C6:77:3F:B8:EB:C5:92:C5:48:6D:F9:72:6D:FE:B0:51`.

Bu fingerprint gizli değildir. Google Android OAuth istemcisinde **bu APK için** kullanılabilir. Actions APK'sının imzası sabit anahtar yapılandırılmadıysa farklı olacaktır; Actions doğrulama çıktısını esas alın.

## Test edilmemiş işlemler

- Gerçek Google hesabı ile OAuth, Drive'a yükleme/listeleme/geri yükleme/silme ve yetki iptali: kullanıcıya ait Google Cloud projesi, Android OAuth istemcisi ve cihaz gerekir.
- Android cihazında ilk kurulum, uygulamayı sonlandırıp açma, güncelleme sonrası kayıtların korunması, fiziksel geri tuşu, klavye, sistem çubukları, farklı ekranlar ve gerçek çevrimdışı grafik kullanımı.
- Android sistem dosya seçicisinden gerçek TXT açma/kaydetme. Java köprüsü derlendi ancak cihaz etkileşimi çalıştırılmadı.
- Chrome'daki kart ekleme prompt'unda otomasyon CDP zaman aşımına uğradı. Windows Computer Use, tarayıcı URL'sini güvenilir biçimde belirleyemediği için oturumu durdurdu. Bu noktadan sonraki UI kontrolleri başarılı sayılmadı.
- İmzalı release APK: yapılandırma hazır; kullanıcıya ait release anahtarıyla derleme yapılmadı.

Telefon üzerinde veri değiştiren test, APK kurulumu, yeni emülatör/SDK indirmesi veya gerçek finansal veri aktarımı yapılmadı. Otomatik yedekleme yalnızca uygulama açıkken/yeniden etkinleştiğinde çalışır; kapalı uygulama için arka plan garantisi yoktur.
