package com.estebanesquare.karttakip;

import android.os.Bundle;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    KartNativePlugin authPlugin;
    final ActivityResultLauncher<IntentSenderRequest> authorization = registerForActivityResult(
        new ActivityResultContracts.StartIntentSenderForResult(), result -> {
            if (authPlugin != null) authPlugin.authorizationResult(result.getResultCode(), result.getData());
        });
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KartNativePlugin.class);
        super.onCreate(savedInstanceState);
        View content=findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content,(view,insets) -> {
            Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard=insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
    }
}
