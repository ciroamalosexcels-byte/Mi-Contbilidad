package com.bois.micontabilidad;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String ACTION_QUICK_VOICE = "com.bois.micontabilidad.ACTION_QUICK_VOICE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(DownloadsPlugin.class);
        handleQuickVoiceIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleQuickVoiceIntent(intent);
    }

    private void handleQuickVoiceIntent(Intent intent) {
        if (intent == null || !ACTION_QUICK_VOICE.equals(intent.getAction())) return;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "if(window.openVoiceAndListen)openVoiceAndListen();", null
                );
            }
        }, 900);
    }
}
