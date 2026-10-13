#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/android/app/src/main/res"
command -v magick >/dev/null || { echo 'ImageMagick 7 (magick) is required' >&2; exit 1; }
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
    density="${pair%:*}"
    size="${pair#*:}"
    mkdir -p "$DEST/mipmap-$density"
    magick "$ROOT/favicon.png" -background black -alpha remove -alpha off -filter point -resize "${size}x${size}" "$DEST/mipmap-$density/ic_launcher.png"
    magick "$DEST/mipmap-$density/ic_launcher.png" \( +clone -alpha extract -fill black -colorize 100 -fill white -draw "circle $((size/2)),$((size/2)) $((size/2)),0" \) -alpha off -compose CopyOpacity -composite "$DEST/mipmap-$density/ic_launcher_round.png"
done
mkdir -p "$DEST/mipmap-anydpi-v26" "$DEST/drawable-nodpi"
# Adaptive icons leave enough black space to preserve the whole drawing under every mask.
magick "$ROOT/favicon.png" -background black -alpha remove -alpha off -filter point -resize 512x512 -gravity center -background black -extent 864x864 "$DEST/drawable-nodpi/ic_launcher_foreground.png"
magick "$DEST/drawable-nodpi/ic_launcher_foreground.png" -threshold 0 -transparent black -fill white -colorize 100 "$DEST/drawable-nodpi/ic_launcher_monochrome.png"
for name in ic_launcher ic_launcher_round; do
    cat > "$DEST/mipmap-anydpi-v26/$name.xml" <<'XML'
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/black"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
XML
done
mkdir -p "$ROOT/android/playstore"
magick "$ROOT/favicon.png" -background black -alpha remove -alpha off -filter point -resize 512x512 "$ROOT/android/playstore/icon.png"
