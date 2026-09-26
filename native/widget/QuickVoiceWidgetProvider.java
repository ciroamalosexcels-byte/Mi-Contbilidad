package com.ciro.flyfinanzas;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

public class QuickVoiceWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "widget_prefs";
    public static final String PREF_THEME = "theme";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, QuickVoiceWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(cn);
        RemoteViews views = buildViews(context);
        for (int id : ids) {
            mgr.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String theme = prefs.getString(PREF_THEME, "light");

        int bgRes;
        int iconRes = R.drawable.ic_widget_mic;
        switch (theme) {
            case "dark": bgRes = R.drawable.bg_widget_oscuro; break;
            case "win": bgRes = R.drawable.bg_widget_win; break;
            case "matrix": bgRes = R.drawable.bg_widget_matrix; break;
            case "neo": bgRes = R.drawable.bg_widget_neo; iconRes = R.drawable.ic_widget_mic_dark; break;
            case "blob": bgRes = R.drawable.bg_widget_blob; break;
            case "mosca": bgRes = R.drawable.bg_widget_mosca; iconRes = R.drawable.ic_widget_mic_pixel; break;
            default: bgRes = R.drawable.bg_widget_claro; break;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_voice);
        views.setInt(R.id.widget_mic_button, "setBackgroundResource", bgRes);
        views.setImageViewResource(R.id.widget_mic_button, iconRes);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(MainActivity.ACTION_QUICK_VOICE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);
        views.setOnClickPendingIntent(R.id.widget_mic_button, pendingIntent);

        return views;
    }
}
