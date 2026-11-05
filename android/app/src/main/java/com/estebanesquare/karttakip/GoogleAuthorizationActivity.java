package com.estebanesquare.karttakip;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

/** Google sonucunu Capacitor'un kaydedilmiş ActivityCallback çağrısına taşır. */
public class GoogleAuthorizationActivity extends ComponentActivity {
    private final ActivityResultLauncher<IntentSenderRequest> launcher=registerForActivityResult(
        new ActivityResultContracts.StartIntentSenderForResult(), result->{setResult(result.getResultCode(),result.getData());finish();});
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(state!=null)return;
        @SuppressWarnings("deprecation") PendingIntent authorization=getIntent().getParcelableExtra("authorization");
        if(authorization==null){setResult(RESULT_CANCELED);finish();return;}
        try{launcher.launch(new IntentSenderRequest.Builder(authorization.getIntentSender()).build());}
        catch(Exception e){setResult(RESULT_CANCELED);finish();}
    }
}
