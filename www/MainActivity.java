package com.visor.archivos;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends Activity {
    WebView web;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(true);
        s.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String u) { handle(getIntent()); }
        });
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        handle(i);
    }

    @Override public void onBackPressed() { finish(); }

    void handle(Intent i) {
        Uri uri = i.getData();
        if (uri == null) uri = i.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;
        try {
            ContentResolver cr = getContentResolver();
            String mime = cr.getType(uri), name = "archivo";
            try (Cursor c = cr.query(uri, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (k >= 0) name = c.getString(k);
                }
            }
            InputStream in = cr.openInputStream(uri);
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            in.close();
            String b64 = Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
            web.evaluateJavascript("openFromAndroid(" + JSONObject.quote(name) + ","
                    + JSONObject.quote(mime == null ? "" : mime) + ",'" + b64 + "')", null);
            setIntent(new Intent());
        } catch (Exception e) { }
    }
}
