package com.increpare.flickgame;

import android.app.Activity;
import android.content.SharedPreferences;
import android.util.Base64;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** One-time cosmetic purchase, following the established iOS supporter behaviour. */
final class Supporter {
    interface Scripts { void evaluate(String script); }
    static final String PRODUCT = "com.increpare.flickgame.supporter";
    private final Activity activity;
    private final Scripts scripts;
    private final SharedPreferences preferences;
    private final BillingClient client;
    private final List<Runnable> waiting = new ArrayList<>();
    private boolean connecting;
    private boolean closed;
    private boolean purchaseBusy;
    private boolean reportConnectionFailure;

    Supporter(Activity activity, Scripts scripts) {
        this.activity = activity;
        this.scripts = scripts;
        preferences = activity.getSharedPreferences("supporter", Activity.MODE_PRIVATE);
        client = BillingClient.newBuilder(activity)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .setListener((result, purchases) -> activity.runOnUiThread(() -> {
                    purchaseBusy = false;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                        process(purchases, false);
                    } else if (result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                        refresh(true);
                    } else if (result.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) unreachable();
                }))
                .build();
    }
    boolean isOwned() { return preferences.getBoolean("owned", false); }
    void show() { scripts.evaluate("document.documentElement.setAttribute('data-supporter','" + isOwned() + "');"); }
    private void unreachable() {
        scripts.evaluate("alert((window.FlickT || String)(\"Couldn't reach Google Play.\"));");
    }
    private void connected(Runnable action, boolean reportFailure) {
        if (closed) return;
        if (client.isReady()) { action.run(); return; }
        waiting.add(action);
        reportConnectionFailure |= reportFailure;
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                activity.runOnUiThread(() -> {
                    connecting = false;
                    if (closed) return;
                    List<Runnable> actions = new ArrayList<>(waiting);
                    waiting.clear();
                    boolean report = reportConnectionFailure;
                    reportConnectionFailure = false;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Runnable callback : actions) callback.run();
                    } else {
                        purchaseBusy = false;
                        if (report) unreachable();
                    }
                });
            }
            @Override public void onBillingServiceDisconnected() { connecting = false; }
        });
    }
    void refresh(boolean reportFailure) {
        connected(() -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> activity.runOnUiThread(() -> {
            if (closed) return;
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) process(purchases, true);
            else if (reportFailure) unreachable();
        })), reportFailure);
    }
    void buy() {
        if (isOwned() || purchaseBusy || closed) return;
        // Never open a charge flow when this build cannot verify its result.
        if (BuildConfig.PLAY_LICENSE_KEY.isEmpty()) { unreachable(); return; }
        purchaseBusy = true;
        connected(() -> {
            QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build();
            client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(product)).build(), (result, details) -> activity.runOnUiThread(() -> {
                if (closed) return;
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details.getProductDetailsList().isEmpty()) {
                    purchaseBusy = false; unreachable(); return;
                }
                ProductDetails item = details.getProductDetailsList().get(0);
                BillingFlowParams.ProductDetailsParams.Builder params = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(item);
                List<ProductDetails.OneTimePurchaseOfferDetails> offers = item.getOneTimePurchaseOfferDetailsList();
                if (offers != null && !offers.isEmpty()) params.setOfferToken(offers.get(0).getOfferToken());
                BillingResult launch = client.launchBillingFlow(activity, BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(params.build())).build());
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    purchaseBusy = false;
                    if (launch.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) refresh(true);
                    else if (launch.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) unreachable();
                }
            }));
        }, true);
    }
    private void process(List<Purchase> purchases, boolean fullRefresh) {
        boolean owned = false;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRODUCT) || purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (!valid(purchase)) continue;
            owned = true;
            if (!purchase.isAcknowledged()) {
                client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(), result -> {
                    // Foreground refresh retries unfinished acknowledgements.
                });
            }
        }
        if (fullRefresh || owned) preferences.edit().putBoolean("owned", owned).apply();
        show();
    }
    private boolean valid(Purchase purchase) {
        try {
            return PurchaseVerifier.verify(Base64.decode(BuildConfig.PLAY_LICENSE_KEY, Base64.DEFAULT),
                    purchase.getOriginalJson().getBytes(StandardCharsets.UTF_8), Base64.decode(purchase.getSignature(), Base64.DEFAULT));
        } catch (IllegalArgumentException e) { return false; }
    }
    void close() { closed = true; waiting.clear(); client.endConnection(); }
}
