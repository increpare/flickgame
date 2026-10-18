package com.increpare.flickgame;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.FrameLayout;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Offline host for the same gallery/editor/player as iOS and the web. */
public final class MainActivity extends Activity {
    private static final int PICK_GAME = 1;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView webView;
    private Supporter supporter;
    private String playTemplate;
    private boolean galleryReady;
    private boolean delivering;
    private int deliveryGeneration;
    private boolean launchImportConsumed;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.BLACK);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        // API 35+ draws edge-to-edge. Consume system/IME/cutout insets once in
        // native layout so the shared CSS sees an already safe viewport.
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                        android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout()
                        | android.view.WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets.consumeSystemWindowInsets();
        });
        frame.requestApplyInsets();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setTextZoom(100);
        // The shared editor handles its own load/resize settling. A second native
        // refresh here can close a picker opened just after the page appears.
        webView.setWebViewClient(new AssetClient(getAssets(), () -> supporter.show()) {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                galleryReady = false;
                // A previous document can no longer acknowledge its import. Keep
                // staged bytes and let the next gallery retry the same project ID.
                deliveryGeneration++;
                delivering = false;
            }
        });
        webView.setWebChromeClient(new Dialogs());
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        try (InputStream stream = getAssets().open("www/play.html")) {
            playTemplate = Base64.encodeToString(FileRules.readBounded(stream, FileRules.MAX_BYTES), Base64.NO_WRAP);
        } catch (IOException e) {
            throw new IllegalStateException("Missing generated web assets", e);
        }
        supporter = new Supporter(this, this::evaluate);
        webView.addJavascriptInterface(new Bridge(), "FlickAndroid");
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        webView.loadUrl(FileRules.HOME);
        io.execute(this::cleanOldExports);
        launchImportConsumed = state != null && state.getBoolean("launchImportConsumed");
        if (!launchImportConsumed) receiveIntent(getIntent());
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("launchImportConsumed", launchImportConsumed);
        super.onSaveInstanceState(state);
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (supporter != null) supporter.refresh(false);
    }
    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        webView.requestApplyInsets();
        evaluate("window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('orientationchange'));");
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        receiveIntent(intent);
    }
    // API 33+ uses the OnBackInvokedDispatcher registered above; this is for older devices.
    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    private void handleBack() {
        webView.evaluateJavascript("window.FlickAndroidHandleBack && window.FlickAndroidHandleBack()", result -> {
            if (!"true".equals(result)) finish();
        });
    }
    @Override protected void onDestroy() {
        supporter.close();
        io.shutdownNow();
        webView.removeJavascriptInterface("FlickAndroid");
        webView.destroy();
        webView = null;
        super.onDestroy();
    }

    private void evaluate(String script) {
        runOnUiThread(() -> {
            if (webView != null && !isFinishing()) webView.evaluateJavascript(script, null);
        });
    }
    private void error(String message) {
        evaluate("alert((window.FlickT || String)(" + JSONObject.quote(message) + "));");
    }
    private void pickGame() {
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        // .flickgame is often labelled octet-stream by document providers.
        picker.setType("*/*");
        try { startActivityForResult(picker, PICK_GAME); }
        catch (android.content.ActivityNotFoundException e) { error("Failed to import"); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_GAME && result == RESULT_OK && data != null && data.getData() != null) {
            importUri(data.getData());
        }
    }
    private void receiveIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            if (Build.VERSION.SDK_INT >= 33) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            else uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri != null) importUri(uri);
    }
    private void importUri(Uri uri) {
        if (!"content".equals(uri.getScheme())) { error("Failed to import"); return; }
        io.execute(() -> {
            try {
                String name = "imported.flickgame";
                try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0);
                }
                byte[] data;
                try (InputStream stream = getContentResolver().openInputStream(uri)) {
                    if (stream == null) throw new IOException("Unreadable document");
                    data = FileRules.readBounded(stream, FileRules.MAX_BYTES);
                }
                JSONObject incoming = new JSONObject();
                incoming.put("name", name);
                incoming.put("token", UUID.randomUUID().toString());
                incoming.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
                File temp = new File(getFilesDir(), "incoming.tmp");
                try (FileOutputStream output = new FileOutputStream(temp)) {
                    output.write(incoming.toString().getBytes(StandardCharsets.UTF_8));
                }
                if (!temp.renameTo(new File(getFilesDir(), "incoming.json"))) throw new IOException("Cannot retain import");
                runOnUiThread(() -> {
                    if (webView == null) return;
                    // The incoming bytes now live in app storage. Do not re-import
                    // the launch Intent when Android recreates this Activity.
                    launchImportConsumed = true;
                    setIntent(new Intent(MainActivity.this, MainActivity.class).setAction(Intent.ACTION_MAIN));
                    if (galleryReady) deliverIncoming();
                    else evaluate("(function(){function go(){location.href='gallery.html';}"
                            + "var ui=window.FlickGalleryUI;"
                            + "if(typeof saveCurrentToGallery==='function'&&ui&&ui.isDirty&&ui.isDirty())"
                            + "{saveCurrentToGallery({silent:true}).then(function(ok){if(ok)go();});}else go();})();");
                });
            } catch (IOException | JSONException | SecurityException e) { error("Failed to import"); }
        });
    }
    private void deliverIncoming() {
        if (!galleryReady || delivering) return;
        delivering = true;
        final int attempt = ++deliveryGeneration;
        io.execute(() -> {
            File file = new File(getFilesDir(), "incoming.json");
            try {
                if (!file.exists()) { runOnUiThread(() -> finishDelivery(attempt)); return; }
                String text;
                try (InputStream stream = new java.io.FileInputStream(file)) {
                    text = new String(FileRules.readBounded(stream, FileRules.MAX_BYTES * 2), StandardCharsets.UTF_8);
                }
                JSONObject incoming = new JSONObject(text);
                String script = "Promise.resolve(window.FlickGalleryPage.importIncoming(" + JSONObject.quote(incoming.getString("data"))
                        + "," + JSONObject.quote(incoming.getString("name")) + ",'play.html',"
                        + JSONObject.quote(incoming.getString("token")) + ")).then(function(ok){"
                        + "FlickAndroid.postMessage('flickIncomingResult',JSON.stringify({token:"
                        + JSONObject.quote(incoming.getString("token")) + ",success:!!ok}));});";
                runOnUiThread(() -> {
                    if (attempt != deliveryGeneration) return;
                    if (webView != null && galleryReady) {
                        webView.evaluateJavascript(script, null);
                    } else {
                        finishDelivery(attempt);
                    }
                });
            } catch (IOException | JSONException e) {
                file.delete();
                error("Failed to import");
                runOnUiThread(() -> finishDelivery(attempt));
            }
        });
    }
    private void finishDelivery(int attempt) {
        if (attempt == deliveryGeneration) delivering = false;
    }
    private void completeIncoming(JSONObject result) {
        final int attempt = deliveryGeneration;
        io.execute(() -> {
            File file = new File(getFilesDir(), "incoming.json");
            try (InputStream stream = new java.io.FileInputStream(file)) {
                JSONObject pending = new JSONObject(new String(FileRules.readBounded(stream,
                        FileRules.MAX_BYTES * 2), StandardCharsets.UTF_8));
                // A newer incoming file must not be removed by an older completion.
                if (pending.getString("token").equals(result.getString("token"))) file.delete();
            } catch (IOException | JSONException e) { /* A missing pending file needs no action. */ }
            runOnUiThread(() -> {
                if (attempt != deliveryGeneration) return;
                finishDelivery(attempt);
                if (galleryReady) deliverIncoming();
            });
        });
    }
    private void exportGame(JSONObject body) {
        io.execute(() -> {
            try {
                String encoded = body.getString("dataBase64");
                if (encoded.length() > (FileRules.MAX_BYTES / 3 + 1) * 4) throw new IOException("File too large");
                byte[] data = Base64.decode(encoded, Base64.DEFAULT);
                if (data.length > FileRules.MAX_BYTES) throw new IOException("File too large");
                String name = FileRules.exportName(body.getString("filename"));
                String id = UUID.randomUUID().toString();
                File directory = new File(getCacheDir(), "exports/" + id);
                if (!directory.mkdirs()) throw new IOException("Cannot create export directory");
                try (FileOutputStream output = new FileOutputStream(new File(directory, name))) { output.write(data); }
                Uri uri = new Uri.Builder().scheme("content").authority(getPackageName() + ".files")
                        .appendPath(id).appendPath(name).build();
                runOnUiThread(() -> {
                    if (isFinishing() || webView == null) return;
                    Intent share = new Intent(Intent.ACTION_SEND).setType(ShareProvider.MIME)
                            .putExtra(Intent.EXTRA_STREAM, uri)
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    share.setClipData(ClipData.newRawUri(name, uri));
                    try { startActivity(Intent.createChooser(share, null)); }
                    catch (android.content.ActivityNotFoundException e) { error("Failed to share"); }
                });
            } catch (IOException | JSONException | IllegalArgumentException e) { error("Failed to share"); }
        });
    }
    private void cleanOldExports() {
        File[] dirs = new File(getCacheDir(), "exports").listFiles();
        if (dirs == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File dir : dirs) {
            if (!dir.isDirectory() || dir.lastModified() > cutoff) continue;
            File[] files = dir.listFiles();
            if (files != null) for (File file : files) file.delete();
            dir.delete();
        }
    }

    final class Bridge {
        @JavascriptInterface public String getPlayTemplate() { return playTemplate; }
        @JavascriptInterface public boolean isSupporter() { return supporter.isOwned(); }
        @JavascriptInterface public String getLanguages() {
            JSONArray languages = new JSONArray();
            Configuration config = getResources().getConfiguration();
            if (Build.VERSION.SDK_INT >= 24) {
                for (int i = 0; i < config.getLocales().size(); i++) languages.put(config.getLocales().get(i).toLanguageTag());
            } else languages.put(config.locale.toLanguageTag());
            return languages.toString();
        }
        @JavascriptInterface public void postMessage(String channel, String json) {
            runOnUiThread(() -> {
                if (webView == null || !FileRules.isPage(webView.getUrl())) return;
                try {
                    switch (channel) {
                        case "flickImport": pickGame(); break;
                        case "flickIncoming":
                            if ("gallery.html".equals(FileRules.assetPath(webView.getUrl()))) {
                                galleryReady = true; deliverIncoming();
                            }
                            break;
                        case "flickIncomingResult": completeIncoming(new JSONObject(json)); break;
                        case "flickExport": exportGame(new JSONObject(json)); break;
                        case "flickSupporter":
                            if ("restore".equals(new org.json.JSONTokener(json).nextValue())) supporter.refresh(true);
                            else supporter.buy();
                            break;
                        default: break;
                    }
                } catch (JSONException e) { error("Failed to import"); }
            });
        }
    }

    private final class Dialogs extends WebChromeClient {
        @Override public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
            // The shared web editor installs a generic browser warning after
            // touching the canvas. Native routes already save or explicitly use
            // Save/Discard/Cancel, so do not present a second browser warning.
            result.confirm();
            return true;
        }
        @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.confirm()).show();
            return true;
        }
        @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
            return true;
        }
        @Override public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
            EditText input = new EditText(MainActivity.this);
            input.setSingleLine(true);
            input.setText(defaultValue);
            new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
            return true;
        }
    }
}
