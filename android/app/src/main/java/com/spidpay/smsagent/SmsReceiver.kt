package com.spidpay.smsagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Registered in AndroidManifest.xml with high priority so we see the SMS
 * as soon as it arrives. We never abort the broadcast (abortBroadcast()
 * is NOT called), so the phone's default SMS app still receives and
 * stores the message exactly as normal — this app only *also* reads it.
 *
 * A local sender-id pre-filter is applied purely to avoid sending every
 * SMS on the phone to the server; the server re-verifies the sender
 * independently and is the actual source of truth for security.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SpidPaySmsReceiver"

        // Loose local pre-filter. Keep this in sync with the backend's
        // OFFICIAL_SENDERS map, but remember: the server is what actually
        // decides is_official_sender, this is just noise reduction.
        private val KNOWN_SENDER_HINTS = mapOf(
            "bkash" to listOf("bkash", "16247"),
            "nagad" to listOf("nagad", "16167"),
            "rocket" to listOf("rocket", "dbbl", "16216"),
            "upay" to listOf("upay"),
            "tap" to listOf("tap"),
            "cellfin" to listOf("cellfin", "islami bank", "ibbl"),
            "surecash" to listOf("surecash"),
            "okwallet" to listOf("ok wallet", "okwallet"),
            "mcash" to listOf("mcash", "mercantile"),
            "meghnapay" to listOf("meghna")
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!Config.isEnabled(context) || !Config.isConfigured(context)) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (msg in messages) {
            val sender = msg.originatingAddress ?: continue
            val body = msg.messageBody ?: continue

            val matchedProvider = guessProvider(sender)
            if (matchedProvider == null) {
                Log.d(TAG, "Ignoring SMS from unrecognized sender: $sender")
                continue
            }

            forwardToServer(context, matchedProvider, sender, body)
        }
    }

    private fun guessProvider(sender: String): String? {
        val lower = sender.lowercase()
        for ((provider, hints) in KNOWN_SENDER_HINTS) {
            if (hints.any { lower.contains(it) }) return provider
        }
        return null
    }

    private fun forwardToServer(context: Context, provider: String, senderId: String, rawText: String) {
        val apiBase = Config.getApiBase(context)
        val apiKey = Config.getApiKey(context)
        val secret = Config.getWebhookSecret(context)

        val signature = HmacUtil.hex(secret, rawText)

        val payload = JSONObject().apply {
            put("provider", provider)
            put("sender_id", senderId)
            put("raw_text", rawText)
            put("signature", signature)
        }

        val client = OkHttpClient()
        val body = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url("$apiBase/sms-ingest")
            .addHeader("x-api-key", apiKey)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to forward SMS to server, queuing for retry", e)
                // নেট নেই বা সার্ভারে পৌঁছানো যায়নি — SMS-টা হারায়নি (ফোনের
                // ইনবক্সে ঠিকই আছে), শুধু forward-টা local queue-তে জমা রাখছি,
                // নেট ফিরে এলে WorkManager নিজে থেকেই আবার পাঠানোর চেষ্টা করবে।
                PendingQueue.add(context, payload)
                scheduleRetry(context)
            }

            override fun onResponse(call: Call, response: okhttp3.Response) {
                Log.d(TAG, "sms-ingest responded: ${response.code}")
                if (!response.isSuccessful && response.code >= 500) {
                    // সার্ভার সাময়িকভাবে ডাউন — এটাও retry-এর যোগ্য
                    PendingQueue.add(context, payload)
                    scheduleRetry(context)
                }
                response.close()
            }
        })
    }

    private fun scheduleRetry(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<RetryWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}
