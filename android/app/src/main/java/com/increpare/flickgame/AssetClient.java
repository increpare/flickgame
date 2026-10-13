package com.increpare.flickgame;

import android.content.res.AssetManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Serves a stable local HTTPS origin for IndexedDB. No request falls through to the network. */
class AssetClient extends WebViewClient {
    private final AssetManager assets;
    private final Runnable pageFinished;
    AssetClient(AssetManager assets, Runnable pageFinished) {
        this.assets = assets;
        this.pageFinished = pageFinished;
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !FileRules.isPage(request.getUrl().toString());
    }
    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return !FileRules.isPage(url);
    }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return blocked();
        String path = FileRules.assetPath(request.getUrl().toString());
        if (path == null) return blocked();
        try {
            InputStream stream = assets.open("www/" + path);
            if (path.equals("play.html")) {
                // Inject only the in-app player response; the export template on disk stays standalone.
                String html;
                try (InputStream input = stream) {
                    html = new String(FileRules.readBounded(input, FileRules.MAX_BYTES), StandardCharsets.UTF_8);
                }
                html = html.replace("<head>", "<head><script src=\"android_bootstrap.js\"></script>"
                        + "<script src=\"i18n.js\"></script><script src=\"android_back.js\"></script>");
                stream = new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8));
            }
            WebResourceResponse response = new WebResourceResponse(mime(path), "UTF-8", stream);
            response.setResponseHeaders(Collections.singletonMap("Content-Security-Policy",
                    "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; "
                    + "style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'self'"));
            return response;
        } catch (IOException e) { return blocked(); }
    }
    @Override public void onPageFinished(WebView view, String url) { pageFinished.run(); }
    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".gif")) return "image/gif";
        return "application/octet-stream";
    }
}
