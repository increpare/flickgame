package com.increpare.flickgame;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;

/** Pure boundaries shared by bundled resource loading and document IO. */
final class FileRules {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String HOME = ORIGIN + "/www/gallery.html";
    static final int MAX_BYTES = 32 * 1024 * 1024;

    static String assetPath(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())
                    || uri.getUserInfo() != null || uri.getPort() != -1) return null;
            String path = uri.getPath();
            if (path == null || !path.startsWith("/www/") || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) return null;
            String relative = path.substring(5);
            for (String segment : relative.split("/", -1)) {
                if (segment.isEmpty() || segment.equals("..") || segment.equals(".")) return null;
            }
            return relative;
        } catch (URISyntaxException | NullPointerException e) { return null; }
    }

    static boolean isPage(String url) {
        String path = assetPath(url);
        return "gallery.html".equals(path) || "index.html".equals(path)
                || "play.html".equals(path) || "help.html".equals(path);
    }

    static String exportName(String filename) {
        String name = filename == null ? "" : filename.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1)
                .replaceAll("[\\p{Cntrl}\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2069\\ufeff:*?\"<>|]", "");
        if (name.endsWith(".flickgame")) name = name.substring(0, name.length() - 10);
        if (name.endsWith(".html")) name = name.substring(0, name.length() - 5);
        name = name.replaceAll("^[. ]+|[. ]+$", "");
        // Bound UTF-8 bytes without splitting a Unicode code point.
        while (name.getBytes(StandardCharsets.UTF_8).length > 120) {
            name = name.substring(0, name.offsetByCodePoints(name.length(), -1));
        }
        return (name.isEmpty() ? "game" : name) + ".flickgame";
    }

    static byte[] readBounded(InputStream stream, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        for (int n; (n = stream.read(buffer)) != -1;) {
            if (out.size() > limit - n) throw new IOException("File is too large.");
            out.write(buffer, 0, n);
        }
        return out.toByteArray();
    }
}
