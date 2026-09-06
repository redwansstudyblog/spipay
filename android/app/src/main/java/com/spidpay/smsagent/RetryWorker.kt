package com.spidpay.smsagent

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Runs whenever WorkManager decides conditions are met (network
 * available), including after the phone reboots or the app was killed —
 * that's the whole point of using WorkManager instead of a plain
 * in-memory retry: it survives process death.
 */
class RetryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val pending = PendingQueue.peekAll(applicationContext)
        if (pending.isEmpty()) return Result.success()

        val apiBase = Config.getApiBase(applicationContext)
        val apiKey = Config.getApiKey(applicationContext)
        val client = OkHttpClient()

        val stillFailing = mutableListOf<JSONObject>()

        for (payload in pending) {
            val ok = trySend(client, apiBase, apiKey, payload)
            if (!ok) stillFailing.add(payload)
        }

        PendingQueue.setAll(applicationContext, stillFailing)

        // যদি এখনো কিছু বাকি থাকে, WorkManager backoff অনুযায়ী পরে আবার চেষ্টা করবে
        return if (stillFailing.isEmpty()) Result.success() else Result.retry()
    }

    private fun trySend(client: OkHttpClient, apiBase: String, apiKey: String, payload: JSONObject): Boolean {
        return try {
            val body = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            val request = Request.Builder()
                .url("$apiBase/sms-ingest")
                .addHeader("x-api-key", apiKey)
                .post(body)
                .build()
            client.newCall(request).execute().use { it.isSuccessful || it.code in 400..499 }
            // 4xx মানে সার্ভার request-টা প্রসেস করেছে (হয়তো reject করেছে) —
            // সেটা আর queue-তে রাখার দরকার নেই, শুধু network/5xx ব্যর্থতাতেই retry করা উচিত
        } catch (_e: Exception) {
            false
        }
    }
}
