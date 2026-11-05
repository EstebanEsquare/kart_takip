package com.estebanesquare.karttakip;

import android.app.Activity;
import android.content.Intent;
import android.util.AtomicFile;
import androidx.activity.result.ActivityResult;
import android.os.Handler;
import android.os.Looper;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.os.Build;
import android.graphics.Color;
import java.security.MessageDigest;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.api.ApiException;
import androidx.core.view.WindowCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

@CapacitorPlugin(name="KartNative")
public class KartNativePlugin extends Plugin {
    private final Object storageLock = new Object();
    private AtomicFile stateFile() { return new AtomicFile(new File(getContext().getFilesDir(), "kart_takip_state_v1.json")); }
    @PluginMethod public void readState(PluginCall call) {
        getBridge().execute(() -> { synchronized(storageLock) {
            AtomicFile file=stateFile();
            try {
                JSObject out=new JSObject();
                try { out.put("value",new String(file.readFully(),StandardCharsets.UTF_8)); }
                catch(FileNotFoundException missing) {
                    // Yalnızca gerçekten ilk kurulumsa boş dön; okuma hatasını boş depo sayma.
                    if(file.getBaseFile().exists() || new File(file.getBaseFile()+".bak").exists()) throw missing;
                }
                call.resolve(out);
            } catch(Exception e) { call.reject("Yerel veri okunamadı."); }
        }});
    }
    @PluginMethod public void writeState(PluginCall call) {
        String value=call.getString("value");
        if(value==null){call.reject("Yerel veri eksik.");return;}
        getBridge().execute(() -> { synchronized(storageLock) {
            AtomicFile file=stateFile(); FileOutputStream stream=null;
            try {
                stream=file.startWrite();stream.write(value.getBytes(StandardCharsets.UTF_8));
                stream.flush();stream.getFD().sync();file.finishWrite(stream);call.resolve();
            } catch(Exception e) { if(stream!=null)file.failWrite(stream);call.reject("Veri diske kaydedilemedi. Eski kayıtlar korundu."); }
        }});
    }
    private PluginCall authCall;
    private String accessToken;
    private final Handler authHandler = new Handler(Looper.getMainLooper());
    private final Runnable authTimeout = () -> rejectAuth("Google hesap seçimi tamamlanmadı. Yeniden bağlan; paket adı ve SHA-1 eşleşmesini Ayarlar ekranından kontrol et.", "AUTH_TIMEOUT");
    private final Scope scope = new Scope("https://www.googleapis.com/auth/drive.file");
    private AuthorizationClient client() { return Identity.getAuthorizationClient(getActivity()); }
    @PluginMethod public void authorize(PluginCall call) {
        if(authCall != null) { call.reject("Google bağlantısı zaten sürüyor.","AUTH_BUSY"); return; }
        authCall=call;
        authHandler.postDelayed(authTimeout,120000);
        int available=GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
        if(available!=ConnectionResult.SUCCESS){rejectAuth("Google Play services kullanılamıyor veya güncel değil. Google Play services'i güncelleyip yeniden dene. Yerel kayıtlarını kullanmaya devam edebilirsin.","PLAY_SERVICES");return;}
        getActivity().runOnUiThread(() -> client().authorize(AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(scope)).build())
            .addOnSuccessListener(result -> {
                if(authCall!=call)return;
                if(result.hasResolution()) {
                    if(Boolean.TRUE.equals(call.getBoolean("silent",false))) { rejectAuth("Drive oturumu yeniden izin istiyor. Yedek ekranından Google Drive’a bağlan.","AUTH_REQUIRED"); return; }
                    try {
                        Intent intent=new Intent(getActivity(),GoogleAuthorizationActivity.class);
                        intent.putExtra("authorization",result.getPendingIntent());
                        // Capacitor çağrıyı kaydeder; sonuç Activity üstündeki geçici plugin alanına bağlı değildir.
                        startActivityForResult(call,intent,"authResult");
                    } catch(Exception e){rejectAuth("Google hesap seçimi açılamadı. Google Play services'i kontrol et.","PLAY_SERVICES");}
                } else finishAuth(call,result);
            }).addOnFailureListener(e -> {if(authCall==call)authorizationFailure(e);}));
    }
    @ActivityCallback private void authResult(PluginCall call, ActivityResult result) {
        if(call==null)return;
        authCall=call;
        if(result.getResultCode()!=Activity.RESULT_OK || result.getData()==null){rejectAuth("Google hesap seçimi tamamlanmadı veya iptal edildi. Yeniden bağlanabilirsin.","AUTH_CANCELLED");return;}
        try { finishAuth(call,client().getAuthorizationResultFromIntent(result.getData())); }
        catch(Exception e){authorizationFailure(e);}
    }
    private void finishAuth(PluginCall call, AuthorizationResult result) {
        if(authCall!=call)return;
        if(result.getAccessToken()==null){rejectAuth("Google Drive erişim izni alınamadı. İzin ekranında Drive erişimini onayla.","AUTH_REQUIRED");return;}
        authHandler.removeCallbacks(authTimeout);accessToken=result.getAccessToken();
        JSObject output=new JSObject(); output.put("token",result.getAccessToken());
        authCall=null;call.resolve(output);getBridge().releaseCall(call);
    }
    private void authorizationFailure(Exception e){
        int code=e instanceof ApiException?((ApiException)e).getStatusCode():-1;
        if(code==10||code==12500)rejectAuth("Google yapılandırması bu APK ile eşleşmiyor. Ayarlar → Bağlantı tanılama bölümündeki paket ve SHA-1 ile Android OAuth istemcisi oluştur; Drive API ve test kullanıcısını da kontrol et. (Google kodu: "+code+")","CONFIGURATION");
        else if(code==7)rejectAuth("Google’a ulaşılamadı. İnternet bağlantını kontrol et. Yerel kayıtların korunuyor.","NETWORK");
        else if(code==16||code==12501)rejectAuth("Google bağlantısı iptal edildi. İstersen yeniden bağlanabilirsin.","AUTH_CANCELLED");
        else rejectAuth("Google Drive izni alınamadı. Paket/SHA-1, test kullanıcısı ve Google Play services ayarlarını kontrol et. (Google kodu: "+code+")","AUTH_REQUIRED");
    }
    private void rejectAuth(String message,String code){authHandler.removeCallbacks(authTimeout);PluginCall call=authCall;authCall=null;if(call!=null){call.reject(message,code);getBridge().releaseCall(call);}}
    @PluginMethod public void cancelAuthorization(PluginCall call){rejectAuth("Google bağlantısı zaman aşımına uğradı.","AUTH_TIMEOUT");call.resolve();}
    @PluginMethod public void invalidateToken(PluginCall call){
        if(accessToken==null){call.resolve();return;}
        String token=accessToken;accessToken=null;
        client().clearToken(ClearTokenRequest.builder().setToken(token).build()).addOnSuccessListener(v->call.resolve()).addOnFailureListener(e->call.reject("Google oturumu yenilenemedi. Yeniden bağlan.","AUTH_REQUIRED"));
    }
    @PluginMethod public void diagnostics(PluginCall call){
        try {
            PackageManager pm=getContext().getPackageManager();String name=getContext().getPackageName();
            @SuppressWarnings("deprecation") PackageInfo info=pm.getPackageInfo(name,Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES);
            @SuppressWarnings("deprecation") Signature[] signatures=Build.VERSION.SDK_INT>=28?info.signingInfo.getApkContentsSigners():info.signatures;
            byte[] digest=MessageDigest.getInstance("SHA-1").digest(signatures[0].toByteArray());StringBuilder sha=new StringBuilder();for(byte b:digest){if(sha.length()>0)sha.append(':');sha.append(String.format(java.util.Locale.ROOT,"%02X",b&255));}
            JSObject output=new JSObject();output.put("packageName",name);output.put("sha1",sha.toString());output.put("version",info.versionName);
            int status=GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());output.put("googlePlayServices",status==0?"Kullanılabilir":"Kullanılamıyor (kod "+status+")");call.resolve(output);
        }catch(Exception e){call.reject("APK imza bilgisi okunamadı.");}
    }
    @SuppressWarnings("deprecation")
    @PluginMethod public void setSystemTheme(PluginCall call){
        getActivity().runOnUiThread(()->{
            boolean light=Boolean.TRUE.equals(call.getBoolean("light",false));
            int color=Color.parseColor(light?"#F2F5F0":"#10191D");
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            getActivity().findViewById(android.R.id.content).setBackgroundColor(color);
            getActivity().getWindow().setStatusBarColor(color);
            getActivity().getWindow().setNavigationBarColor(color);
            WindowCompat.getInsetsController(getActivity().getWindow(),getActivity().getWindow().getDecorView()).setAppearanceLightStatusBars(light);
            WindowCompat.getInsetsController(getActivity().getWindow(),getActivity().getWindow().getDecorView()).setAppearanceLightNavigationBars(light);
            call.resolve();
        });
    }
    @Override protected void handleOnDestroy(){
        authHandler.removeCallbacks(authTimeout);authCall=null;accessToken=null;
        super.handleOnDestroy();
    }
    @PluginMethod public void disconnect(PluginCall call) {
        getActivity().runOnUiThread(() -> client().revokeAccess(RevokeAccessRequest.builder()
            .setScopes(Collections.singletonList(scope)).build())
            .addOnSuccessListener(v -> {accessToken=null;call.resolve();}).addOnFailureListener(e -> call.reject("Google erişimi kaldırılamadı; bağlantınızı kontrol edin.")));
    }
    @PluginMethod public void readBackup(PluginCall call) {
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("*/*");intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call,intent,"readResult");
    }
    @ActivityCallback private void readResult(PluginCall call,ActivityResult result) {
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("Dosya seçimi iptal edildi.");return;}
        getBridge().execute(() -> {
            try(InputStream in=getContext().getContentResolver().openInputStream(result.getData().getData()); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192];int n,total=0;
                while((n=in.read(buffer))!=-1){total+=n;if(total>20*1024*1024)throw new IOException("Dosya 20 MB sınırını aşıyor.");out.write(buffer,0,n);}
                JSObject response=new JSObject();response.put("text",out.toString(StandardCharsets.UTF_8.name()));call.resolve(response);
            }catch(Exception e){call.reject("Yedek okunamadı: "+e.getMessage());}
        });
    }
    @PluginMethod public void writeBackup(PluginCall call) {
        if(call.getString("text")==null){call.reject("Yedek metni eksik.");return;}
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.setType("text/plain");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_TITLE,call.getString("name","kart_takip.txt"));
        startActivityForResult(call,intent,"writeResult");
    }
    @ActivityCallback private void writeResult(PluginCall call,ActivityResult result) {
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("Kaydetme iptal edildi.");return;}
        getBridge().execute(() -> {
            try(OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData(),"wt")) {
                out.write(call.getString("text").getBytes(StandardCharsets.UTF_8));out.flush();call.resolve();
            }catch(Exception e){call.reject("Yedek kaydedilemedi.");}
        });
    }
}
