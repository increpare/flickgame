package com.increpare.flickgame;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
public class PurchaseVerifierTest {
    @Test public void onlyThePlaySignedPurchaseIsAccepted() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair key = generator.generateKeyPair();
        byte[] data = "{\"productId\":\"supporter\"}".getBytes(StandardCharsets.UTF_8);
        Signature signature = Signature.getInstance("SHA1withRSA");
        signature.initSign(key.getPrivate()); signature.update(data);
        byte[] signed = signature.sign();
        assertTrue(PurchaseVerifier.verify(key.getPublic().getEncoded(), data, signed));
        assertFalse(PurchaseVerifier.verify(key.getPublic().getEncoded(), new byte[]{1,2,3}, signed));
        assertFalse(PurchaseVerifier.verify(new byte[0], data, signed));
        signed[0] ^= 1;
        assertFalse(PurchaseVerifier.verify(key.getPublic().getEncoded(), data, signed));
    }
}
