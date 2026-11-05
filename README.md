# Kart Takip 1.1 — Android

Çevrimdışı kredi kartı ekstre takibi. Capacitor 8, yerel Chart.js ve Material 3 yaklaşımından yararlanan yeni mobil arayüz. Android 7.0 / API 24 ve üzeri, güncel Android System WebView gerekir. Uygulamanın paket kimliği **com.estebanesquare.karttakip** olarak korunmuştur; sürüm kodu **2**, sürüm **1.1**.

**Temiz kurulum boştur. APK’ya kişisel finansal veri, test kaydı veya örnek kart eklenmez.** Kart, tutar ve geçmiş kayıtları kurulumdan sonra kullanıcı oluşturur veya yedekten aktarır.

## Yeni arayüz

Uzun tek sayfa yerine alt gezinmeyle erişilen beş ekran vardır:

| Ekran     | İçerik                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| Özet      | Seçili ayın toplamı, ödenen/bekleyen tutar ve sayılar, kartlar, aylık ekstreler              |
| Ekstreler | Tümü/bekleyen/ödenen filtresi, ödeme rozetleri, düzenleme                                    |
| Geçmiş    | Serbest yıl girişi, kayıtlı yıl önerileri, 12 aylık yerel grafik, aydan aya seçim            |
| Yedek     | TXT kaydetme/yükleme, metin yapıştırma, birleştirme/değiştirme ve Google Drive               |
| Ayarlar   | Koyu/açık/sistem teması, otomatik yedek, Google bağlantısı tanılama, çıkış ve veri temizliği |

Kart ve ekstre ekleme alt panelde yapılır. Tutar alanı `1.250,50`, `1250,50` veya `1250.50` kabul eder. Aynı kart/yıl/ay kaydı güncellenir; ödeme durumu korunur. Geri tuşu önce açık paneli kapatır, sonra Özet’e döner; Özet’te çıkış onayı ister. Tema seçimi kalıcıdır. Harici font, CDN, reklam veya analitik kullanılmaz.

**Ekstre günü son ödeme tarihi değildir.** Önceki veri yapısında son ödeme tarihi alanı olmadığı için bu bilgi uydurulmaz; gün alanı aynen korunur. Negatif ekstre tutarı (alacak) desteklenir.

## APK indirme ve kurulum

1. GitHub **Actions → Android APK** bölümünden bu dalın son başarılı çalışmasını açın.
2. **Artifacts → kart-takip-debug-apk** dosyasını indirin. GitHub oturumu gerekir.
3. ZIP içinde `app-debug.apk`, `APK-imzasi.txt` ve `SHA256.txt` bulunur. APK’yı telefona gönderip açın.
4. Android isterse kullandığınız dosya yöneticisi/tarayıcı için uygulama yükleme izni verin. Kurulum bitince bu izni kapatabilirsiniz.
5. Uygulama boş açılır. Yerel özellikleri kullanmak için Google hesabı gerekmez.

Artifact 30 gün tutulur. Workflow push/PR ile çalışır; main’e alındıktan sonra **Run workflow** ile de başlatılabilir. Derleme başarısızsa APK üretildiği varsayılmamalıdır.

### Güncelleme ve imza — veri kaybetmemek için

Güncellemede **aynı paket kimliği ve aynı imzalama anahtarı** gerekir. Uygulamayı kaldırmayın/verilerini temizlemeyin; yeni APK’yı üzerine yükleyin. Depo dosyasının adı ve v7/v8 veri mantığı değiştirilmemiştir. Yine de güncellemeden önce TXT yedeği alın.

GitHub’ın geçici runner’ında üretilen debug anahtarı her çalışmada değişebilir. Bu durum hem “Uygulama yüklenmedi / imza uyuşmuyor” hatasına hem Google OAuth SHA-1 eşleşmesinin bozulmasına yol açar. Önceki APK’nın imzasıyla eşleşmeyen APK, verileri koruyarak üzerine kurulamaz. Eski runner’da kaybolan özel anahtarı uygulama koduyla geri getirmek mümkün değildir; böyle bir durumda eski uygulamadan TXT yedeği alıp yeni kurulumda aktarın.

Kalıcı test sürümleri için kendi debug keystore’unuzu güvenli yerde saklayın; base64 içeriğini repository **Settings → Secrets and variables → Actions → ANDROID_DEBUG_KEYSTORE_BASE64** secret’ına ekleyin. Workflow bunu `$HOME/.android/debug.keystore` konumunda kullanır. Standart debug alias `androiddebugkey`, parola `android` olmalıdır. Aynı anahtarı yerel derlemelerde de kullanın. Anahtar/parola depoya veya herkese açık Actions cache’ine konmaz. Secret yoksa workflow açık uyarı verir ve geçici debug imzasıyla devam eder.

## Yerel kayıtlar ve TXT aktarımı

Android kayıtları uygulamaya özel `files/kart_takip_state_v1.json` dosyasındadır. Android **AtomicFile**, disk senkronizasyonu ve sıralı yazım kullanılır. Başarılı disk yazımından sonra UI güncellenir. Bozuk depo boş veri sayılarak üstüne yazılmaz; düzenleme durdurulur. Web önizlemede localStorage kullanılır. Cihazdaki dosya ayrıca uygulama parolasıyla şifrelenmez; Android uygulama yalıtımı ve cihaz kilidiyle korunur.

- **TXT yedeği kaydet:** Android sistem kaydetme seçicisini açar; geniş depolama izni gerekmez.
- **Telefonumdan yükle:** `.txt` veya `.json` dosyasını Android dosya seçicisinden okuyun.
- Alternatif: **Yedek metnini yapıştır** bölümünü açıp JSON içeriğini yükleyin.
- **Verileri Birleştir:** Mevcut kart ve kayıtlar korunur; yenileri eklenir. Aynı kart/yıl/ay farklı tutar, gün veya ödeme durumu içeriyorsa iki değer ayrı gösterilir; mevcut/gelen/iptal seçilir.
- **Verileri Değiştir:** Onaydan sonra seçilen yedek mevcut verinin yerini alır.
- Önceki veri ve yeni veri aynı atomik işlemde saklanır. **Aktarım öncesi güvenlik kopyasını geri al** son aktarımı geri çevirebilir. Bu kopya aynı cihazda olduğundan TXT/Drive yedeğinin yerini tutmaz.
- Bozuk dosya, iptal veya başarısız yazım mevcut veriyi değiştirmez. Aktarım sonunda okunan ve sonuçtaki kayıt sayıları görünür.

Eski `cc_tracker_v7` ve `cc_tracker_v8` TXT biçimi okunur: `{cards:["Kart adı"],statements:[{card,amount,day,year,month,isPaid}]}`. Bu anahtarlarla sarılı JSON da desteklenir. Sayısal yıl metne normalize edilir; yıl/ay/gün, tutar ve ödeme durumu değiştirilmez. Hiçbir geçmiş ay filtrelenip atılmaz. Aynı yedeği iki kez yüklemek kayıtları çoğaltmaz. Yıl alanı 1–9999, gün 1–31; dosya 20 MB, kart 1000, ekstre 100000 ile sınırlıdır. Eksik alanlar ve yedek içinde çelişen tekrarlar reddedilir.

Tüm yerel verileri silme, onaydan sonra kartları/ekstreleri/güvenlik kopyasını tek işlemde temizler ve otomatik yedeği kapatır. Drive’daki dosyalar silinmez. Kart adları HTML olarak çalıştırılmaz; `textContent` kullanılır.

## Google Drive nasıl çalışır?

Google hesabı yalnızca Drive’a dosya yüklemek/listelemek/indirmek için gerekir. **Bağlanmadan uygulamanın tüm yerel özellikleri çalışır.** Google’a Android’in resmi hesap/izin ekranından bağlanılır; uygulama parola istemez.

Akış:

1. **Yedek → Google Drive’a bağlan** düğmesine dokunun ve Google hesabınızı seçin.
2. Uygulama Google’dan token aldıktan sonra Drive `about.get` ile erişimi doğrular ve yedekleri getirir. Hesap seçiminin açılması tek başına başarı sayılmaz.
3. Başarıda hesap bilgisi, “Bağlı” durumu ve yedek listesi görünür. Boş liste açıkça “henüz yedek yok” olarak gösterilir.
4. **Şimdi yedekle** yeni bir dosya oluşturur. **Yedekleri getir** listeyi tarih sırasıyla yeniler.
5. Bir dosyada **Bu yedeği geri yükle** seçilince dosya doğrulanır ve TXT ile aynı birleştir/değiştir/çakışma akışından geçer.
6. **Ayarlar → Google hesabından çıkış yap** uygulamanın Drive iznini iptal eder. Telefondaki Google hesabınızı kaldırmaz.

Google Identity Services **AuthorizationClient + OAuth 2.0**, yalnızca `https://www.googleapis.com/auth/drive.file` kapsamıyla kullanılır. Profil kapsamı veya tüm Drive içeriğine erişim istenmez. Hesabın adı/e-postası Drive’ın kendi `about` yanıtından görüntülenir; diske kaydedilmez. Web OAuth client secret, backend, Firebase veya `google-services.json` gerekmez. Erişim tokenı yalnızca geçici bellektedir; diske/Git’e yazılmaz. Capacitor veri köprüsünün günlüklemesi hassas veri taşımamak için kapalıdır.

Dosyalar **Kart Takip Yedekleri** klasöründe `kart_takip_YYYY-AA-GG_SSDDss_benzersiz.json` adıyla saklanır. Önceki yedeğin üzerine otomatik yazılmaz. “Sil” kalıcı silme öncesi onay ister. Dar kapsam nedeniyle başka uygulamalardan Drive’a yüklenmiş tüm eski TXT dosyaları listelenmez; böyle yedekleri telefona indirip dosyadan aktarabilirsiniz.

Yedekler düz JSON’dur; HTTPS ile aktarılır ve Google Drive hesabının korumasından yararlanır. **Uçtan uca şifrelenmez.** TXT dosyaları da düz metindir. Google dışında başka bir sunucuya kullanıcı verisi gönderilmez.

### Hesap seçiminden sonra neden hiçbir şey görünmüyordu?

Önceki UI, sonuç/hata metnini uzun sayfanın üstüne yazıyor; Drive düğmeleri aşağıdayken kullanıcı bu metni göremeyebiliyordu. İşlem ilerlemesi, bağlı hesap ve kalıcı Drive hata alanı yoktu. Hesap seçimi dönüşü MainActivity üstündeki geçici plugin alanına bağlıydı; yeniden oluşturma durumunda çağrı kaybolabilirdi. Ağ/yetkilendirme beklemeleri için zaman aşımı yoktu ve OAuth/API hataları ayrıntılandırılmıyordu.

1.1’de sonuç **Capacitor’un kaydettiği ActivityCallback çağrısından**, dışa kapalı GoogleAuthorizationActivity üzerinden döner. Activity yeniden oluşturulması raporlanır. Hesap seçimi 120 saniye, ağ istekleri yaklaşık 30 saniye ile sınırlıdır; sessiz bekleme yerine hata gösterilir. 401 durumunda token önbelleği temizlenir ve bir kez yenilenir. API kapalı/izin/kota/ağ sorunları ayrı Türkçe mesaj verir. Yerel veri değişmez.

**Kullanıcının cihazındaki asıl Google hata kodu alınmadığından kesin tek bir kök neden doğrulanmadı. Bu kod düzeltmeleri, Google Cloud yapılandırmasının doğru olduğu veya gerçek hesapta uçtan uca testin tamamlandığı anlamına gelmez.**

## Google Cloud Console — adım adım

### 1. Proje ve Drive API

1. [Google Cloud Console](https://console.cloud.google.com/) üzerinde kendi projenizi oluşturun veya seçin.
2. **APIs & Services → Library** açın, **Google Drive API** arayın ve **Enable** seçin.
3. **Google Auth Platform → Branding** altında uygulama adını **Kart Takip**, destek e-postası ve geliştirici iletişim adreslerini kendi bilgilerinizle doldurun.
4. **Audience** altında kişisel hesap için **External**, geliştirmede **Testing** seçin. **Test users** listesine bağlanacağınız Google e-postasını ekleyin. Şirket hesabı politikaları ayrıca erişimi sınırlayabilir.
5. **Data Access → Add or remove scopes** altında yalnızca `https://www.googleapis.com/auth/drive.file` ekleyin.

### 2. Kullanacağınız APK’nın SHA-1 bilgisini alın

En kolay yöntem: telefonda **Ayarlar → Bağlantı tanılama → APK ve Google bilgilerini göster**. Bu ekran paket, sürüm, **kurulu APK’nın gerçek SHA-1’i** ve Google Play services durumunu gösterir.

Alternatifler:

- Actions çalışmasının **Summary** bölümündeki sertifika çıktısı veya artifact içindeki `APK-imzasi.txt`.
- Yerelde Android klasöründe Windows: `.\gradlew.bat signingReport`; macOS/Linux: `./gradlew signingReport`.
- Elinizdeki APK için Android SDK aracı: `apksigner verify --print-certs app-debug.apk`.

SHA-256 veya dosyanın SHA-256 özetini SHA-1 alanına yazmayın. Yerel APK ile Actions APK’sı aynı anahtarla imzalanmadıysa SHA-1’leri farklıdır.

### 3. Android OAuth istemcisi oluşturun

**Google Auth Platform → Clients → Create client** altında:

| Alan                          | Girilecek değer                                      |
| ----------------------------- | ---------------------------------------------------- |
| Application type              | **Android**                                          |
| Name                          | Örneğin **Kart Takip Debug**                         |
| Package name                  | **com.estebanesquare.karttakip**                     |
| SHA-1 certificate fingerprint | Önceki adımda kullanacağınız APK’dan aldığınız SHA-1 |

**Create** ile kaydedin. İstemci ID’si/parolası uygulama kaynaklarına yapıştırılmaz; Android akışı paket adı ve imza üzerinden eşleşir. **Web application/Desktop** türü bu eşleşmenin yerine geçmez. Ayarların yayılması zaman alabilir. Sonra uygulamadan yeniden bağlanın.

Release APK’nızı başka anahtarla imzalarsanız **aynı paket adı + release SHA-1** için ayrı Android istemcisi oluşturun. Debug istemcisi farklı imzalı release’i yetkilendirmez. Kalıcı anahtar seçmeden her Actions APK’sına yeni OAuth istemcisi eklemek sürdürülebilir değildir.

### Hataları ayırma

| Belirti                        | Kontrol                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Google kodu 10 / 12500         | Android istemcisi, kurulu APK paket/SHA-1 eşleşmesi, test kullanıcısı              |
| Drive API kapalı               | Aynı Cloud projesinde Google Drive API → Enable                                    |
| 403 erişim reddedildi          | drive.file izni, test kullanıcısı ve kuruluş hesap politikası                      |
| Hesap seçimi iptal/zaman aşımı | Yeniden bağlanın; tanılama ekranındaki bilgileri doğrulayın                        |
| 401                            | Bir kez token yenilenir; sürerse yeniden bağlanın                                  |
| Ağ zaman aşımı                 | Bağlantıyı kontrol edip yeniden deneyin; yerel kayıtlar korunur                    |
| Bağlı ama liste boş            | Bu uygulamanın oluşturduğu/erişimine açılan yedekler görünür; ilk yedeği oluşturun |

Kaynaklar: [Android yetkilendirme](https://developer.android.com/identity/authorization), [Drive kapsamları](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Android OAuth istemcileri](https://developers.google.com/identity/protocols/oauth2/native-app).

## Otomatik yedekleme

Varsayılan kapalıdır. Drive bağlandıktan sonra Ayarlar’dan açılır. Veri değişiklikleri 30 saniye birleştirilir. Bekleyen yedek bayrağı kalıcıdır; bağlantı geri geldiğinde veya uygulama yeniden açıldığında denenir. Otomatik akış Google izin ekranı açmaz; izin yenilenmesi gerekiyorsa elle bağlanmanız söylenir. Son başarılı tarih görüntülenir. Yükleme sırasında yeni kayıt oluşursa yeni sürüm bekleyen olarak kalır.

**Kapalı uygulamada arka plan garantisi yoktur**; WorkManager servisi eklenmemiştir. Drive hatası, iptal, bozuk indirme veya yetki eksikliği yerel veriyi silmez.

## Geliştirme ve mimari

- `src/data.js`: Değişmeyen v7/v8 yapısı, doğrulama, birleştirme ve sıralı depo yazımı.
- `src/controller.js`: Ekranlar, kullanıcı işlemleri, diyaloglar ve yaşam döngüsü.
- `src/ui.js`: Güvenli DOM bileşenleri, tutar/dönem gösterimi.
- `src/drive.js`: OAuth köprüsü, HTTP zaman aşımı, hata sınıfları ve Drive protokolü.
- `src/app.js`: Capacitor/Chart.js giriş ve platform adaptörleri.
- `src/app.css` + `index.html`: Tema, mobil yerleşim, erişilebilir formlar ve ekranlar.
- `design/icon.svg`: Yeni simgenin vektör kaynağı. `npm run icons` PNG yoğunluklarını üretir. Android adaptive ve monochrome kaynakları `res/drawable` altındadır.

Node 22+, JDK 21, Android SDK platform 36 / build-tools 36.0.0 gerekir. Büyük emülatör gerekmez.

```powershell
npm ci
npm test
npm run sync
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\User\AppData\Local\Android\Sdk'
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

Kendi SDK yolunuzu `android/local.properties` içinde `sdk.dir=C\:/.../Android/Sdk` biçiminde yazın veya ANDROID_HOME tanımlayın. Bu dosya Git’e eklenmez. Windows’ta Türkçe proje yolu için `android.overridePathCheck=true` tanımlıdır.

APK yolu: `android/app/build/outputs/apk/debug/app-debug.apk`. Web önizleme: `npm run build`, ardından `node scripts/preview.mjs`, sonra `http://127.0.0.1:4173`. Kaynak HTML doğrudan açılmaz; `www` servis edilir. Build açık dosya izin listesi kullanır; çıktı dizininde beklenmeyen dosya varsa paketleme durur. Testler, node_modules ve kişisel dosyalar APK’ya kopyalanmaz.

### İmzalı release

Bir kez kendinize ait keystore oluşturun; güvenli, çevrimdışı kopyasını saklayın:

```text
keytool -genkeypair -keystore kart-takip-release.jks -alias karttakip -keyalg RSA -keysize 3072 -validity 10000
```

`KART_KEYSTORE_PATH`, `KART_STORE_PASSWORD`, `KART_KEY_ALIAS`, `KART_KEY_PASSWORD` ortam değişkenlerini kendi değerlerinizle tanımlayıp `./gradlew assembleRelease` çalıştırın. Parolaları komut geçmişine/depoya yazmayın. İmzalama ayarı olmadan unsigned release kurulamaz. Anahtar kaybolursa aynı paketle veri koruyan güncelleme yapılamayabilir. Debug’dan farklı imzalı release’e geçmeden TXT yedeği alın. Her sürümde versionCode artırılmalıdır.

## Test kapsamı ve sınırlar

`npm test` veri/Drive protokolü testlerini ve jsdom ile gerçek arayüz olay akışlarını çalıştırır. Gerçek Google hesabı kullanılmaz. Chart.js’nin gerçek çizimi ayrıca tarayıcıda kontrol edilir; DOM testlerinde Chart adaptörü taklittir.

Gerçek Google hesabında hesap seçimi dönüşü, Drive dosyası oluşturma/listeleme/indirme/silme; Android üretici cihazlarında dosya seçici, klavye, sistem çubukları, süreç öldürme ve imzalı güncelleme ayrıca denenmelidir. Cihaza APK yükleyen veya verilerini değiştiren otomatik test çalıştırılmaz. Güncel derleme, test ve doğrulama ayrıntıları `TEST-REPORT.md` içindedir.
