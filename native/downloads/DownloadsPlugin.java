package com.bois.micontabilidad;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "Downloads",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class DownloadsPlugin extends Plugin {
    @PluginMethod
    public void savePdf(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        writePdf(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            writePdf(call);
        } else {
            call.reject("Android no autorizó el acceso a Descargas.");
        }
    }

    private void writePdf(PluginCall call) {
        String requestedName = call.getString("name", "Metricas-mensuales.pdf");
        String name = requestedName.replaceAll("[^A-Za-z0-9._-]", "-");
        String encoded = call.getString("data");
        if (encoded == null || encoded.isEmpty()) {
            call.reject("El PDF está vacío.");
            return;
        }

        final byte[] data;
        try {
            data = Base64.decode(encoded, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("El contenido del PDF no es válido.", error);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            writeWithMediaStore(call, name, data);
        } else {
            writeLegacy(call, name, data);
        }
    }

    private void writeWithMediaStore(PluginCall call, String name, byte[] data) {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
        values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Android no creó el archivo.");
            try (OutputStream stream = resolver.openOutputStream(uri, "w")) {
                if (stream == null) throw new IllegalStateException("Android no abrió el archivo.");
                stream.write(data);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            resolveSaved(call, name, uri);
        } catch (Exception error) {
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("No se pudo guardar el PDF en Descargas.", error);
        }
    }

    private void writeLegacy(PluginCall call, String name, byte[] data) {
        try {
            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!downloads.exists() && !downloads.mkdirs()) throw new IllegalStateException("No se pudo crear Descargas.");
            File file = new File(downloads, name);
            try (FileOutputStream stream = new FileOutputStream(file, false)) {
                stream.write(data);
            }
            MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { "application/pdf" }, (path, uri) -> {
                if (uri == null) {
                    call.reject("El PDF se guardó, pero Android no pudo registrarlo.");
                } else {
                    resolveSaved(call, name, uri);
                }
            });
        } catch (Exception error) {
            call.reject("No se pudo guardar el PDF en Descargas.", error);
        }
    }

    private void resolveSaved(PluginCall call, String name, Uri uri) {
        JSObject result = new JSObject();
        result.put("name", name);
        result.put("uri", uri.toString());
        call.resolve(result);
    }

    @PluginMethod
    public void setWidgetTheme(PluginCall call) {
        String theme = call.getString("theme", "light");
        getContext().getSharedPreferences(QuickVoiceWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
            .edit().putString(QuickVoiceWidgetProvider.PREF_THEME, theme).apply();
        QuickVoiceWidgetProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    @PluginMethod
    public void openPdf(PluginCall call) {
        String value = call.getString("uri");
        if (value == null || value.isEmpty()) {
            call.reject("No se recibió la ubicación del PDF.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(value), "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(Intent.createChooser(intent, "Abrir PDF"));
            call.resolve();
        } catch (Exception error) {
            call.reject("No hay una aplicación disponible para abrir el PDF.", error);
        }
    }
}
