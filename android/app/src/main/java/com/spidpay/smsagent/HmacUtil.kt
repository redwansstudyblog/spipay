package com.spidpay.smsagent

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Must produce the exact same hex string as the hmacHex() function
 * used in the sms-ingest Supabase Edge Function, since the server
 * recomputes this over raw_text and compares.
 */
object HmacUtil {
    private const val ALGORITHM = "HmacSHA256"

    fun hex(secret: String, message: String): String {
        val mac = Mac.getInstance(ALGORITHM)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), ALGORITHM))
        val raw = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        return raw.joinToString("") { "%02x".format(it) }
    }
}
