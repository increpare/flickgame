# WebView calls these methods by name.
-keepclassmembers class com.increpare.flickgame.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
