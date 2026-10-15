package com.increpare.flickgame;

import android.content.Intent;
import android.graphics.Bitmap;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.SystemClock;
import android.app.Instrumentation;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import static org.junit.Assert.*;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONTokener;

/** Runs against the real Android WebView and document provider, without browser mocks. */
@SuppressWarnings("deprecation")
public final class ShellTest {
    private MainActivity activity;
    private WebView web;
    private Instrumentation getInstrumentation() { return InstrumentationRegistry.getInstrumentation(); }
    @Before public void setUp() throws Exception {
        activity = (MainActivity) getInstrumentation().startActivitySync(new Intent(
                getInstrumentation().getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        getInstrumentation().runOnMainSync(() -> {
            ViewGroup content = activity.findViewById(android.R.id.content);
            web = (WebView) ((ViewGroup) content.getChildAt(0)).getChildAt(0);
        });
        waitFor("document.readyState==='complete' && window.FlickGalleryPage && document.querySelectorAll('.gallery-card').length >= 4");
        screenshot("01-gallery");
    }
    @After public void tearDown() {
        getInstrumentation().runOnMainSync(activity::finish);
        getInstrumentation().waitForIdleSync();
    }
    private void screenshot(String name) throws Exception {
        if (!"true".equals(InstrumentationRegistry.getArguments().getString("screenshots"))) return;
        File dir = new File(activity.getFilesDir(), "screenshots");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        File file = new File(dir, name + ".png");
        if (file.exists()) return;
        SystemClock.sleep(300);
        Bitmap image = getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(image);
        try (FileOutputStream out = new FileOutputStream(file)) { image.compress(Bitmap.CompressFormat.PNG, 100, out); }
        image.recycle();
    }
    private String js(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        getInstrumentation().runOnMainSync(() -> web.evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        // Chromium may discard an evaluation callback when its document is
        // replaced. Readiness polling retries against the new document.
        if (!done.await(3, TimeUnit.SECONDS)) {
            assertFalse("Activity exited during JS evaluation: " + script, activity.isFinishing());
            return "null";
        }
        return result.get();
    }
    private void waitFor(String condition) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            if ("true".equals(js("Boolean(" + condition + ")"))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + condition + "; page=" + js("location.href"));
    }
    private void back() { getInstrumentation().runOnMainSync(activity::onBackPressed); }
    private void editFirst() throws Exception { editProject(null); }
    private void editProject(String title) throws Exception {
        waitFor("location.pathname.endsWith('/gallery.html') && document.querySelector('.gallery-ibtn[data-icon=edit]')");
        if (title == null) js("document.querySelector('.gallery-ibtn[data-icon=edit]').click()");
        else js("Array.from(document.querySelectorAll('.gallery-card')).find(c=>c.querySelector('.gallery-title')?.textContent==="
                + org.json.JSONObject.quote(title) + ").querySelector('.gallery-ibtn[data-icon=edit]').click()");
        waitFor("location.pathname.endsWith('/index.html') && typeof stateToString==='function' && document.getElementById('mainCanvas')");
        waitFor("document.readyState==='complete' && window.FlickAndroidBackToGallery && window.FlickGalleryUI");
        waitFor("!window.FlickGalleryUI.isDirty()"); // wait for the saved snapshot, not just script globals
        screenshot("02-editor");
    }
    @Test public void testGalleryEditorRotationAndPlayer() throws Exception {
        assertEquals("\"android-app\"", js("window.FLICKGAME_HOST"));
        assertEquals("true", js("!!document.documentElement.style.getPropertyValue('--ios-icon-share')"));
        editProject("icecream");
        js("showPagePicker(1)");
        waitFor("document.querySelector('.page-picker.visible')");
        screenshot("04-link");
        assertEquals("Link picker closed during layout settling", "true", js("!!document.querySelector('.page-picker.visible')"));
        back();
        waitFor("!document.querySelector('.page-picker.visible')");
        js("showFramePicker()");
        waitFor("document.querySelector('#frame-picker.visible')");
        screenshot("03-pages");
        assertEquals("Page picker closed during layout settling", "true", js("!!document.querySelector('#frame-picker.visible')"));
        back();
        waitFor("!document.querySelector('#frame-picker.visible')");
        String before = js("stateToString()");
        // Android 16 ignores requested orientation on large screens. Tablet runs
        // exercise both display shapes using emulator size overrides instead.
        boolean tablet = "true".equals(InstrumentationRegistry.getArguments().getString("tablet"));
        if (!tablet) {
            getInstrumentation().runOnMainSync(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("innerWidth > innerHeight");
        }
        assertEquals("rotation changed game state", before, js("stateToString()"));
        screenshot("06-editor-landscape");
        js("document.getElementById('mobile-burger-btn').click()");
        waitFor("document.getElementById('burger-dialog').classList.contains('visible')");
        back();
        waitFor("!document.getElementById('burger-dialog').classList.contains('visible')");
        back();
        waitFor("location.pathname.endsWith('/gallery.html') && document.querySelector('.gallery-ibtn[data-icon=play]')");
        if (!tablet) {
            getInstrumentation().runOnMainSync(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("innerHeight>innerWidth");
        }
        js("Array.from(document.querySelectorAll('.gallery-card')).find(c=>c.querySelector('.gallery-title')?.textContent==='icecream').querySelector('.gallery-ibtn[data-icon=play]').click()");
        waitFor("location.pathname.endsWith('/play.html') && document.body && document.body.getAttribute('data-host')==='android-app'");
        assertEquals("true", js("typeof window.FlickAndroidHandleBack==='function'"));
        screenshot("05-play");
        back();
        waitFor("location.pathname.endsWith('/gallery.html')");
        getInstrumentation().runOnMainSync(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
    }
    @Test public void testGalleryColumnsAndNewGameFitsCanvasArea() throws Exception {
        // A 720x1600 phone at 320dpi is only 360 CSS px wide; the gallery must still show two columns.
        assertTrue("Gallery shows a single column", Integer.parseInt(js(
                "getComputedStyle(document.getElementById('gallery-grid')).gridTemplateColumns.split(' ').length")) >= 2);
        assertEquals("false", js("document.documentElement.scrollWidth > innerWidth"));
        js("document.querySelector('.gallery-tile').click()");
        waitFor("location.pathname.endsWith('/index.html') && location.search.includes('id=') && window.FlickGalleryUI && document.getElementById('mainCanvas')");
        waitFor("!window.FlickGalleryUI.isDirty()");
        // The new canvas is shaped like the space it has, not like the screen or the 160x100 default.
        assertEquals("true", js("Math.max(width, height) === 160"));
        assertEquals("New game does not fit its canvas area", "true", js(
                "(function(){var r=document.getElementById('mobile-canvas-container').getBoundingClientRect();"
                + "return Math.abs(width/height - r.width/r.height) < 0.03;})()"));
        screenshot("07-new-game");
    }
    @Test public void testHelpAndSaveDiscardBackFlow() throws Exception {
        editFirst();
        js("canvasses[0][0] = (canvasses[0][0]+1)%16; saveFlickgameState();");
        waitFor("window.FlickGalleryUI.isDirty()");
        back();
        waitFor("document.querySelector('.ios-choice-overlay')");
        back();
        waitFor("!document.querySelector('.ios-choice-overlay')");
        assertEquals("true", js("location.pathname.endsWith('/index.html')"));
        assertEquals("Cancel changed dirty state", "true", js("FlickGalleryUI.isDirty()"));
        js("document.getElementById('mobile-burger-btn').click(); Array.from(document.querySelectorAll('.ios-editor-action')).find(b=>b.textContent.includes((window.FlickT||String)('Help'))).click()");
        waitFor("document.getElementById('ios-help-overlay')");
        back();
        waitFor("!document.getElementById('ios-help-overlay')");
        assertEquals("Help changed dirty state", "true", js("FlickGalleryUI.isDirty()"));
        back();
        waitFor("document.querySelector('.ios-choice-overlay')");
        js("document.querySelector('.ios-choice-btn').click()");
        waitFor("location.pathname.endsWith('/gallery.html')");
        editFirst();
        waitFor("!window.FlickGalleryUI.isDirty()");
        String saved = js("stateToString()");
        js("canvasses[0][0]=(canvasses[0][0]+1)%16; saveFlickgameState()");
        back();
        waitFor("document.querySelector('.ios-choice-overlay')");
        js("document.querySelectorAll('.ios-choice-btn')[1].click()");
        waitFor("location.pathname.endsWith('/gallery.html')");
        editFirst();
        assertEquals("Discard changed the saved game", saved, js("stateToString()"));
    }
    @Test public void testReadOnlyProviderAndIncomingGameNeverExecuteHtml() throws Exception {
        js("window.__export=null; FlickGalleryStore.listProjects().then(p=>FlickgameShare.buildStandaloneHtmlString(p[0].state)).then(html=>window.__export=html)");
        waitFor("typeof window.__export==='string'");
        String html = (String) new JSONTokener(js("window.__export")).nextValue();
        html += "<script>window.__untrustedExecuted=true;</script>";
        File dir = new File(activity.getCacheDir(), "exports/instrumentation");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        File file = new File(dir, "猫.flickgame");
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(html.getBytes(StandardCharsets.UTF_8)); }
        Uri uri = new Uri.Builder().scheme("content").authority(activity.getPackageName()+".files")
                .appendPath("instrumentation").appendPath(file.getName()).build();
        try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
            assertTrue(FileRules.readBounded(in, FileRules.MAX_BYTES).length > 100);
        }
        try {
            activity.getContentResolver().openOutputStream(uri);
            fail("share provider allowed writing");
        } catch (java.io.FileNotFoundException expected) { }
        js("window.__putProject=FlickGalleryStore.putProject; FlickGalleryStore.putProject=function(p){window.__saving=true;return new Promise(resolve=>setTimeout(()=>resolve(window.__putProject(p)),1500));}");
        final Intent incoming = new Intent(activity, MainActivity.class).setAction(Intent.ACTION_VIEW)
                .setDataAndType(uri, ShareProvider.MIME).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        getInstrumentation().runOnMainSync(() -> activity.startActivity(incoming));
        waitFor("window.__saving===true");
        assertTrue("Pending import removed before IndexedDB committed", new File(activity.getFilesDir(), "incoming.json").exists());
        waitFor("location.pathname.endsWith('/play.html') && location.search.includes('id=') && document.readyState==='complete' && window.FlickAndroidHandleBack");
        assertEquals("false", js("!!window.__untrustedExecuted"));
        assertEquals(Intent.ACTION_MAIN, activity.getIntent().getAction());
        back();
        waitFor("location.pathname.endsWith('/gallery.html')");
        waitFor("Array.from(document.querySelectorAll('.gallery-title')).some(x=>x.textContent==='猫')");
    }
    @Test public void testInterruptedImportResumesWithoutDuplicates() throws Exception {
        js("window.__export=null; FlickGalleryStore.listProjects().then(p=>FlickgameShare.buildStandaloneHtmlString(p[0].state)).then(html=>window.__export=html)");
        waitFor("typeof window.__export==='string'");
        String html = (String) new JSONTokener(js("window.__export")).nextValue();
        File dir = new File(activity.getCacheDir(), "exports/interrupted");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        File file = new File(dir, "Interrupted.flickgame");
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(html.getBytes(StandardCharsets.UTF_8)); }
        Uri uri = new Uri.Builder().scheme("content").authority(activity.getPackageName()+".files")
                .appendPath("interrupted").appendPath(file.getName()).build();
        // Commit the project, but destroy the document before its completion reaches native.
        js("window.__put=FlickGalleryStore.putProject; FlickGalleryStore.putProject=p=>window.__put(p).then(saved=>{window.__committed=true;return new Promise(resolve=>setTimeout(()=>resolve(saved),30000));})");
        getInstrumentation().runOnMainSync(() -> activity.startActivity(new Intent(activity, MainActivity.class)
                .setAction(Intent.ACTION_VIEW).setDataAndType(uri, ShareProvider.MIME).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)));
        waitFor("window.__committed===true");
        assertTrue(new File(activity.getFilesDir(), "incoming.json").exists());
        editFirst();
        back();
        waitFor("location.pathname.endsWith('/play.html') && location.search.includes('id=') && document.readyState==='complete' && window.FlickAndroidHandleBack");
        back();
        waitFor("location.pathname.endsWith('/gallery.html') && window.FlickGalleryPage");
        js("window.__count=null; FlickGalleryStore.listProjects().then(items=>window.__count=items.filter(p=>p.title==='Interrupted').length)");
        waitFor("window.__count!==null");
        assertEquals("Retry duplicated the imported game", "1", js("window.__count"));
        waitFor("document.querySelector('.gallery-ibtn[data-icon=edit]')");
        assertFalse("Completed import still staged", new File(activity.getFilesDir(), "incoming.json").exists());
    }
    @Test public void testTouchDrawingSavesAndSurvivesReopening() throws Exception {
        js("document.querySelector('.gallery-tile').click()");
        waitFor("location.pathname.endsWith('/index.html') && location.search.includes('id=') && window.FlickGalleryUI");
        js("window.__diff=null; FlickGalleryStore.getProject(new URLSearchParams(location.search).get('id')).then(p=>{var a=JSON.parse(p.state),b=JSON.parse(stateToString());window.__diff=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>[k,a[k],b[k]]);})");
        waitFor("window.__diff!==null");
        assertEquals("New project changed after saving: " + js("window.__diff"), "false", js("FlickGalleryUI.isDirty()"));
        js("setColor(1)");
        String before = js("stateToString()");
        JSONArray point = new JSONArray(js("(function(){var r=document.getElementById('mainCanvas').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth];})()"));
        int[] origin = new int[2];
        getInstrumentation().runOnMainSync(() -> web.getLocationOnScreen(origin));
        float scale = web.getWidth() / (float) point.getDouble(2);
        float x = origin[0] + (float) point.getDouble(0) * scale;
        float y = origin[1] + (float) point.getDouble(1) * scale;
        long down = SystemClock.uptimeMillis();
        for (int i=0; i<3; i++) {
            int action = i==0 ? MotionEvent.ACTION_DOWN : i==2 ? MotionEvent.ACTION_UP : MotionEvent.ACTION_MOVE;
            MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x+i*20, y, 0);
            event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            getInstrumentation().sendPointerSync(event);
            event.recycle();
            SystemClock.sleep(50);
        }
        waitFor("FlickGalleryUI.isDirty()");
        assertNotEquals("Touch did not change the drawing", before, js("stateToString()"));
        String drawn = js("stateToString()");
        js("window.__saved=false; saveCurrentToGallery({silent:true}).then(ok=>window.__saved=ok)");
        waitFor("window.__saved===true && !FlickGalleryUI.isDirty()");
        back();
        waitFor("location.pathname.endsWith('/gallery.html') && document.querySelector('.gallery-ibtn[data-icon=edit]')");
        editFirst();
        assertEquals("Saved drawing changed on reopen", drawn, js("stateToString()"));
    }
    @Test public void testExternalNavigationIsBlocked() throws Exception {
        assertEquals("false", js("fetch('https://example.com').then(()=>window.__network=true,()=>window.__network=false);false"));
        waitFor("window.__network===false");
        js("location.href='https://example.com/'");
        SystemClock.sleep(300);
        assertEquals("true", js("location.href.startsWith('https://appassets.androidplatform.net/www/')"));
    }
}
