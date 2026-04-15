.PHONY: sync-ios ios-icons
# Copy web assets from repo root into the Xcode bundle folder (same as Xcode "Sync web assets").
sync-ios:
	ios/scripts/sync-web-assets.sh "$(CURDIR)" ios/FlickgameShell/FlickgameShell/www

# Regenerate iOS AppIcon from repo-root favicon.png (ImageMagick `magick` required).
ios-icons:
	ios/scripts/generate-app-icons-from-favicon.sh "$(CURDIR)" ios/FlickgameShell/FlickgameShell/Assets.xcassets/AppIcon.appiconset
