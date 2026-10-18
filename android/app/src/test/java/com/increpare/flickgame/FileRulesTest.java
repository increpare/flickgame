package com.increpare.flickgame;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;

public class FileRulesTest {
    @Test public void onlyPrivateBundledOriginIsAllowed() {
        assertEquals("gallery.html", FileRules.assetPath("https://appassets.androidplatform.net/www/gallery.html?id=abc"));
        assertNull(FileRules.assetPath("https://evil.test/www/gallery.html"));
        assertNull(FileRules.assetPath("http://appassets.androidplatform.net/www/gallery.html"));
        assertNull(FileRules.assetPath("https://appassets.androidplatform.net:444/www/gallery.html"));
        assertNull(FileRules.assetPath("https://x@appassets.androidplatform.net/www/gallery.html"));
        assertNull(FileRules.assetPath("file:///etc/passwd"));
    }
    @Test public void traversalAndEncodedTraversalAreRejected() {
        assertNull(FileRules.assetPath("https://appassets.androidplatform.net/www/../secret"));
        assertNull(FileRules.assetPath("https://appassets.androidplatform.net/www/%2e%2e/secret"));
        assertNull(FileRules.assetPath("https://appassets.androidplatform.net/www/a%2f..%2fsecret"));
        assertNull(FileRules.assetPath("https://appassets.androidplatform.net/www/%5csecret"));
        assertFalse(FileRules.isPage("https://appassets.androidplatform.net/www/example_game.js"));
        assertTrue(FileRules.isPage("https://appassets.androidplatform.net/www/play.html?id=a"));
    }
    @Test public void exportNamesCannotEscapeCacheAndPreserveUnicode() {
        assertEquals("猫.flickgame", FileRules.exportName("../../猫.flickgame"));
        assertEquals("game.flickgame", FileRules.exportName(".."));
        assertEquals("game.flickgame", FileRules.exportName(""));
        assertFalse(FileRules.exportName("a\n\u202efile.html").contains("\u202e"));
        assertTrue(FileRules.exportName("x".repeat(300)).length() <= 130);
    }
    @Test public void importsAreBoundedEvenWhenProviderDoesNotReportSize() throws Exception {
        assertArrayEquals(new byte[]{1,2,3}, FileRules.readBounded(new ByteArrayInputStream(new byte[]{1,2,3}), 3));
        try {
            FileRules.readBounded(new ByteArrayInputStream(new byte[]{1,2,3,4}), 3);
            fail("oversized import accepted");
        } catch (IOException expected) { assertTrue(expected.getMessage().contains("large")); }
    }
}
