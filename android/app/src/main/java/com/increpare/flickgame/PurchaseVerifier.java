package com.increpare.flickgame;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/** Local verification keeps the cosmetic supporter purchase independent of a backend. */
final class PurchaseVerifier {
    static boolean verify(byte[] key, byte[] data, byte[] signed) {
        try {
            Signature signature = Signature.getInstance("SHA1withRSA");
            signature.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(key)));
            signature.update(data);
            return signature.verify(signed);
        } catch (GeneralSecurityException | IllegalArgumentException e) { return false; }
    }
}
