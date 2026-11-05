# Kart Takip — Android

Koyu tasarımı koruyan, Capacitor 8 tabanlı çevrimdışı kredi kartı ekstre takibi. Paket kimliği: `com.estebanesquare.karttakip`. Android 7.0 (API 24) ve üzeri, güncel Android System WebView gerekir. Chart.js APK içinde paketlenir; uygulamayı açmak, kart/ekstre kaydetmek ve grafik görmek için internet gerekmez.

## Özellikler ve veri güvenliği

- İlk kurulumda **hiçbir kart, ekstre veya örnek harcama yoktur**. Web paketi açık dosya izin listesiyle hazırlanır; testler ve kişisel yedekler APK'ya kopyalanmaz.
- Kart ekleme, yıl/ay/kart seçme, tutar/gün kaydetme, düzenleme, ödendi durumunu değiştirme, aylık toplam ve seçilen yılın 12 aylık grafiği korunur. Yıl alanına 1–9999 arasında istediğiniz yılı yazabilirsiniz; kayıtlı yıllar önerilir. 2024–2030 sınırı kaldırılmıştır.
- Android'de uygulamaya özel Android AtomicFile (fsync ve atomik dosya değiştirme), web önizlemede localStorage kullanılır. Veri yazımı başarılı olmadan ekrandaki veri değiştirilmez. Depo açılamazsa kayıtların üzerine yazılmasını önlemek için düzenleme kapatılır.
- İçe aktarma öncesi güvenlik kopyası ve yeni kayıtlar aynı depo anahtarına yazılır. Son aktarım öncesi kopya uygulamadan geri alınabilir. Hatalı dosya eski kayıtları değiştirmez. Güvenlik kopyası cihazdaki asıl depodan bağımsız bir felaket kurtarma yedeği değildir; TXT/Drive yedeğinizi de saklayın.
- Kart adları DOM'a `textContent` ile yazılır. Harici script, analitik veya reklam bulunmaz. Google Drive dışında kullanıcı verisi gönderilen bir sunucu yoktur.
- Yalnızca INTERNET izni tanımlanır. Dosyalar Android sistem dosya seçicisiyle açılır/kaydedilir; geniş depolama izni istenmez. Android otomatik uygulama yedeği kapalıdır. Cihazdaki veritabanı ayrıca şifrelenmez; Android uygulama yalıtımı ve cihaz kilidiyle korunur.
- Google erişim belirteci yalnızca geçici bellektedir; Preferences'a, dosyaya, günlüklere veya Git'e yazılmaz. Yeniden açılışta Google Play services üzerinden yeniden yetki alınır; uygulama refresh token saklamaz.

## APK indirme ve telefona kurma

1. Bu değişikliklerin bulunduğu branch veya PR için GitHub **Actions → Android APK** çalışmasını açın. PR/push otomatik derleme başlatır. Workflow main'e alındıktan sonra **Run workflow** ile elle de başlatabilirsiniz.
2. Başarılı çalışmanın **Artifacts → kart-takip-debug-apk** dosyasını indirin (GitHub oturumu gerekir).
3. ZIP'i açın; `app-debug.apk` dosyasını telefona gönderin.
4. Telefonda APK'yı açın; Android isterse yalnızca kullandığınız dosya yöneticisi/tarayıcı için bilinmeyen uygulama yükleme iznini verin. Kurulumdan sonra bu izni kapatabilirsiniz.
5. Uygulama boş açılır. Eski TXT yedeğinizi aşağıdaki adımlarla yükleyin.

APK Actions Artifacts içinde 30 gün tutulur; kaynak depoya eklenmez. Başarısız çalışmada indirilecek APK yoktur. Debug sürüm kişisel deneme içindir.

### Güncellemelerde kayıtları koruma ve sabit imza

**Aynı paket kimliği ve aynı imzalama anahtarı** ile yeni APK'yı mevcut uygulamanın üzerine yükleyin; uygulamayı kaldırmayın ve verilerini temizlemeyin. Her sürümde `versionCode` artırılmalıdır. Kaldırma/telefon kaybı halinde yalnızca dışarı aldığınız TXT/Drive yedekleri kurtarılabilir.

GitHub'ın geçici runner'ında otomatik üretilen debug anahtarı her çalışmada değişebilir. Böyle bir APK önceki APK üzerine güncellenemez ve OAuth SHA-1'i de değişir. Kalıcı test için kendi bilgisayarınızda oluşturduğunuz debug keystore'u saklayın; base64 içeriğini repository **Settings → Secrets and variables → Actions → ANDROID_DEBUG_KEYSTORE_BASE64** secret'ına koyun. Workflow bunu `$HOME/.android/debug.keystore` konumuna yükler. Standart debug alias/parola `androiddebugkey` / `android` olmalıdır. Anahtarın kendisini depoya yüklemeyin. Yerel ve Actions APK'larının güncellenebilmesi için aynı anahtarı kullanın. Gerçek kişisel verilerle kullanmadan önce sabit anahtar seçmeniz önerilir.

## Eski TXT yedeğini yükleme

1. Eski web uygulamasından TXT yedeği alın; ayrı bir kopyasını saklayın.
2. Yeni uygulamada **Aktarım yöntemi** seçin: **Verileri Birleştir** mevcut kayıtları korur, **Verileri Değiştir** mevcut kart ve ekstre listesini seçili yedekle değiştirir ve onay ister.
3. **Telefonumdan Yedek Yükle** ile `.txt` veya `.json` dosyasını seçin. Alternatif: içeriği metin alanına yapıştırıp **METNİ YÜKLE** seçin. Drive geri yüklemesi de aynı aktarım yöntemini kullanır.
4. Aynı kart + yıl + ay farklı değer içeriyorsa tutar, gün ve ödeme durumu karşılaştırılır. **Mevcut**, **Gelen** veya **İptal** seçin. Her çakışma ayrı sorulur; iptal edilirse hiçbir değişiklik uygulanmaz.
5. İşlem sonunda yedekteki ve sonuçtaki kart/ekstre sayıları gösterilir. Son aktarımı geri almak için **Aktarım öncesi güvenlik yedeğini geri al** kullanın.

v7/v8'in `{cards: ["Kart adı"], statements: [{card, amount, day, year, month, isPaid}]}` JSON yapısı desteklenir. Yıl sayısı veya metni kabul edilir, depoda metin olarak normalize edilir; yıl/ay/gün değiştirilmez. `cc_tracker_v7` / `cc_tracker_v8` anahtarlarıyla sarılı JSON da okunur. Herhangi bir aydaki kayıtlar filtrelenip atılmaz. Aynı yedeğin tekrar yüklenmesi çoğaltma yapmaz. Eksik/bozuk alanlar, tanımsız kartlar ve yedek içinde birbiriyle çelişen tekrarlar reddedilir. 20 MB dosya, 1000 kart, 100000 ekstre sınırı uygulanır. Gün eski formatla uyumlu olarak 1–31'dir; aylara göre yeni tarih üretimi/düzeltmesi yapılmaz.

## Google Drive bağlantısı

**Gerçek hesaptaki uçtan uca doğrulama, size ait Google Cloud yapılandırması ve cihazla yapılmalıdır. Kodun derlenmesi veya taklit servis testinin geçmesi Google hesabınızda çalıştığının kanıtı değildir.**

Android Google Identity Services `AuthorizationClient` ve OAuth 2.0 kullanılır. **Google hesabını bağla** Google'ın hesap seçme/izin ekranını açar. Profil/e-posta kapsamı istenmez; uygulama hesap kimlik bilgisi göstermez. **Drive’a şimdi yedekle** yeni dosya oluşturur. **Drive yedeklerini listele** tarih sıralamasıyla yükleme ve silme seçenekleri sunar. **Google hesabından çıkış yap** uygulamanın Drive yetkisini iptal eder; cihazdaki Google hesabını kaldırmaz.

Yalnızca `https://www.googleapis.com/auth/drive.file` kapsamı kullanılır. `Kart Takip Yedekleri` klasöründe `kart_takip_YYYY-AA-GG_SSDDss_benzersiz.json` isimleriyle ayrı dosyalar oluşturulur; eski dosyalar üzerine yazılmaz. Silme düğmesi onaydan sonra seçilen dosyayı Drive'dan kalıcı siler. Bu dar kapsam uygulamanın oluşturduğu veya kendisine açılmış dosyaları görür; Drive'a başka yoldan yüklenmiş tüm eski yedekleri kendiliğinden listelemez. Böyle dosyaları telefona indirip TXT/JSON olarak içe aktarabilirsiniz. Aynı uygulama/Google Cloud projesini koruyun.

Yedekler düz JSON'dur. HTTPS ile aktarılır ve Google Drive'ın hesap/depolama korumasından yararlanır; **uçtan uca veya uygulama parolasıyla şifrelenmiş değildir**. TXT dışa aktarımları da düz metindir.

### Google Cloud Console: sizin tamamlayacağınız ayarlar

1. [Google Cloud Console](https://console.cloud.google.com/) üzerinde bir proje oluşturun veya kendi projenizi seçin.
2. **APIs & Services → Library → Google Drive API → Enable** seçin.
3. **Google Auth Platform → Branding** bölümünde uygulama adını `Kart Takip`, destek ve geliştirici iletişim e-postalarını kendi bilgilerinizle doldurun.
4. **Audience** bölümünde kişisel hesap için **External**, geliştirmede **Testing** seçin. **Test users** listesine kendi Google e-posta adresinizi ekleyin. Test modundaki izinlerin süresi dolarsa uygulamadan yeniden bağlanın.
5. **Data Access → Add or remove scopes** bölümüne yalnızca `https://www.googleapis.com/auth/drive.file` ekleyin. Tam Drive kapsamı eklemeyin.
6. **Clients → Create client → Android** seçin. Paket adı: `com.estebanesquare.karttakip`. **Web application** veya Desktop istemcisi kullanmayın.
7. İndireceğiniz APK'yı imzalayan anahtarın SHA-1 parmak izini girin. Yerelde `cd android` ardından `./gradlew signingReport` (Windows: `gradlew.bat signingReport`) kullanabilirsiniz. Actions adımı `apksigner verify --print-certs` ile sertifika özetini de gösterir. Sabit debug anahtarı kullanmadığınızda SHA-1 her derlemede değişebilir.
8. Release anahtarı farklıysa o SHA-1 için aynı paket adını içeren ayrı Android OAuth istemcisi oluşturun. Ayarların yayılması biraz zaman alabilir. Google Play services bulunan telefonda Google hesabını bağlayıp bir deneme yedeği yükleyin, listeleyin ve geri yükleyin.

Bu Android yetkilendirme akışında web istemci sırrı, `google-services.json`, sunucu veya GitHub'a kaydedilen token gerekmez; eşleştirme paket adı + imza SHA-1 ile yapılır. OAuth onay/uygulama doğrulaması Google hesabınızın politikalarına göre ek işlem gerektirebilir.

Kaynaklar: [Android yetkilendirme](https://developer.android.com/identity/authorization), [Drive kapsamları](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Android OAuth istemcisi](https://developers.google.com/identity/protocols/oauth2/native-app).

### İsteğe bağlı otomatik yedek

Varsayılan kapalıdır. Açıldığında değişiklikler 30 saniye birleştirilir; her tuşta dosya yüklenmez. Bekleyen yedek bilgisi cihazda kalıcıdır. Bağlantı geri geldiğinde veya uygulama yeniden etkinleştiğinde tekrar denenir. Son başarılı tarih ve hatalar ekranda gösterilir. Otomatik işlem kullanıcıya Google izin ekranı açmaz; yeniden yetki gerekirse elle bağlanmanız istenir. **Uygulama kapalıyken arka plan yedeklemesi garanti edilmez**; WorkManager servisi yoktur. Uygulamayı açıp kullanırken çalışır. Ağ hataları yerel kayıtları silmez.

## Geliştirme ve yerel APK derleme

Gerekenler: Node.js 22+, JDK 21, Android SDK platform 36 / build-tools 36.0.0, kabul edilmiş SDK lisansları. Capacitor 8.0.0 ve bağımlılıkları lock dosyasında sabittir. Android Studio'nun `jbr` dizini JDK olarak kullanılabilir. Büyük emülatör indirmek gerekmez.

```powershell
npm ci
npm test
npm run sync
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\User\AppData\Local\Android\Sdk'
cd android
.\gradlew.bat assembleDebug lintDebug
```

Kendi SDK yolunuzu `android/local.properties` içinde `sdk.dir=C\:/.../Android/Sdk` olarak tanımlayın veya ANDROID_HOME kullanın. `local.properties` Git'e girmez. APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Windows'ta Türkçe çalışma klasörü için `android.overridePathCheck=true` ayarı vardır; araçlar sorun çıkarırsa ASCII proje yolu kullanın.

Web önizleme: `npm run build`, ardından `node scripts/preview.mjs`; `http://127.0.0.1:4173` açın. Kaynak `index.html` doğrudan açılmak yerine oluşturulmuş `www` dizininden servis edilmelidir. Drive ve Android dosya köprüsü APK içinde çalışır.

### İmzalı release

`android/app/build.gradle` ortam değişkenlerinden isteğe bağlı release imzası okur. Bir kez kendinize ait anahtar oluşturun ve güvenli, çevrimdışı bir kopyasını saklayın:

```text
keytool -genkeypair -keystore kart-takip-release.jks -alias karttakip -keyalg RSA -keysize 3072 -validity 10000
```

`KART_KEYSTORE_PATH`, `KART_STORE_PASSWORD`, `KART_KEY_ALIAS`, `KART_KEY_PASSWORD` ortam değişkenlerini kendi anahtarınıza göre ayarlayıp `./gradlew assembleRelease` çalıştırın. Şifreleri komut geçmişine veya depoya yazmayın. İmzalama ayarı olmadan üretilen unsigned release kurulamaz. Keystore veya parola kaybolursa aynı uygulamayı veri koruyarak güncellemek mümkün olmayabilir. Debug'dan farklı imzalı release'e geçmeden önce TXT yedeği alın; Android farklı imzalı güncellemeyi reddeder.

## Testler ve bilinen sınırlar

`npm test` veri katmanı ve taklit Drive servisi için otomatik testleri çalıştırır. Temiz depo, kart/ekstre, ödeme korunması, yeniden açılış, eski/gelecek yıl, v7/v8, mükerrer yükleme, birleştirme/değiştirme/iptal, bozuk dosya, yazma hatası ve ağ kesintisi kapsam içindedir. Testlerde yalnızca sentetik kayıtlar kullanılır.

Gerçek Google hesabında bağlama/yükleme/listeleme/geri yükleme/silme, Android cihazda dosya seçme/kaydetme, fiziksel geri tuşu, klavye, sistem çubuğu ve farklı üretici ekranları ayrıca cihaz üzerinde denenmelidir. Telefon üzerinde veri değiştiren otomatik test yapılmaz. Tam test/derleme durumu `TEST-REPORT.md` dosyasındadır.
