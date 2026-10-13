.PHONY: sync-ios ios-icons
# Copy web assets from repo root into the Xcode bundle folder (same as Xcode "Sync web assets").
sync-ios:
	ios/scripts/sync-web-assets.sh "$(CURDIR)" ios/FlickgameShell/FlickgameShell/www

# Regenerate iOS AppIcon from repo-root favicon.png (ImageMagick `magick` required).
ios-icons:
	ios/scripts/generate-app-icons-from-favicon.sh "$(CURDIR)" ios/FlickgameShell/FlickgameShell/Assets.xcassets/AppIcon.appiconset

.PHONY: sync-android android-icons android-test android-debug android-release
sync-android:
	node android/scripts/sync-web-assets.cjs "$(CURDIR)" android/app/build/generated/flickgame/assets/www
android-icons:
	android/scripts/generate-icons.sh
android-test:
	node --test android/test/*.test.cjs
	cd android && ./gradlew testDebugUnitTest lintDebug
android-debug:
	cd android && ./gradlew assembleDebug
android-release:
	cd android && ./gradlew bundleRelease

.PHONY: android-store-art
android-store-art:
	node android/scripts/generate-feature-graphic.mjs
