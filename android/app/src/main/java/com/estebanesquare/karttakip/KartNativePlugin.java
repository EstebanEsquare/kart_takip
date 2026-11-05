package com.estebanesquare.karttakip;

import android.app.Activity;
import android.content.Intent;
import android.util.AtomicFile;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.IntentSenderRequest;
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
    private final Scope scope = new Scope("https://www.googleapis.com/auth/drive.file");
    private AuthorizationClient client() { return Identity.getAuthorizationClient(getActivity()); }
    @PluginMethod public void authorize(PluginCall call) {
        if(authCall != null) { call.reject("Yetkilendirme zaten sürüyor."); return; }
        authCall=call;
        getActivity().runOnUiThread(() -> client().authorize(AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(scope)).build())
            .addOnSuccessListener(result -> {
                if(result.hasResolution()) {
                    if(Boolean.TRUE.equals(call.getBoolean("silent",false))) { rejectAuth("Drive bağlantısı için Google hesabını yeniden bağlayın."); return; }
                    MainActivity activity=(MainActivity)getActivity(); activity.authPlugin=this;
                    activity.authorization.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
                } else finishAuth(result);
            }).addOnFailureListener(e -> rejectAuth("Google yetkilendirmesi başarısız. OAuth paket adı ve SHA-1 ayarlarını kontrol edin.")));
    }
    void authorizationResult(int code, Intent data) {
        if(authCall==null)return;
        if(code!=Activity.RESULT_OK || data==null){rejectAuth("Google bağlantısı iptal edildi.");return;}
        try { finishAuth(client().getAuthorizationResultFromIntent(data)); }
        catch(Exception e){rejectAuth("Google yetkilendirme sonucu alınamadı.");}
    }
    private void finishAuth(AuthorizationResult result) {
        if(result.getAccessToken()==null){rejectAuth("Google erişim izni alınamadı.");return;}
        JSObject output=new JSObject(); output.put("token",result.getAccessToken());
        PluginCall call=authCall;authCall=null;if(call!=null)call.resolve(output);
    }
    private void rejectAuth(String message){PluginCall call=authCall;authCall=null;if(call!=null)call.reject(message);}
    @PluginMethod public void disconnect(PluginCall call) {
        getActivity().runOnUiThread(() -> client().revokeAccess(RevokeAccessRequest.builder()
            .setScopes(Collections.singletonList(scope)).build())
            .addOnSuccessListener(v -> call.resolve()).addOnFailureListener(e -> call.reject("Google erişimi kaldırılamadı; bağlantınızı kontrol edin.")));
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
