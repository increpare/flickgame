# Play release preparation

The app source, generated icon, English listing, privacy text and review instructions
are prepared here. Release credentials and Play Console resources belong to the
developer account; they are not created or published by the local build.

1. Create the Play app with package `com.increpare.flickgame` and use Play App Signing.
   Reuse your existing Android upload key if you have one; keep it outside this repo.
2. Create a one-time, non-consumable product `com.increpare.flickgame.supporter` with
   the same supporter offering and price as iOS. Use one regular purchase option;
   the app selects its eligible offer. Product IDs must be lowercase on Play.
3. Put the app's RSA public license key in `FLICKGAME_PLAY_LICENSE_KEY` and supply
   the signing variables in [the build guide](../README.md). Build the signed AAB.
4. Upload to an internal testing track. With a Play license tester, test purchase,
   cancellation, pending completion, restore/reinstall, refund and offline startup.
   All tools must work identically with and without the purchase. Confirm the
   merged manifest still requests only the billing permission.
5. Use listing-en-GB.json, icon.png and review-notes.txt. Screenshots are under
   screenshots/phone/, screenshots/tablet-portrait/ and screenshots/tablet-landscape/.
   They are captured from Android 16; tablet captures use emulated large-screen
   viewports. Use feature-graphic.png for the Play feature graphic. The interface
   already shares all the iOS translations.
   iOS description translations can be adapted later; they are not Android listings.
6. Publish privacy-policy.txt at a stable public URL you control and enter that URL
   in Play Console. Review Data safety with the final SDK/build: the app does not
   upload work, access contacts/location, collect app analytics or run ads. Purchases
   are handled by Google's service; do not describe app-owned payment-card storage.
7. Complete Play's content-rating, app-access, audience and account-verification
   forms using the established product/account decisions. This is a user-created
   drawing tool with no online user-content discovery or account requirements.
8. Increment versionCode for later uploads. Run the verification commands, then
   submit the signed release bundle after the internal purchase tests pass.

This preparation does not submit or publish the app. The locally built unsigned
AAB demonstrates that the release compiler and R8 pipeline work; it is not a signed
upload artifact.

Official references:
- [Target API requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Product ID rules](https://support.google.com/googleplay/android-developer/answer/1153481)
- [Billing integration/testing](https://developer.android.com/google/play/billing/integrate)
- [Store asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
