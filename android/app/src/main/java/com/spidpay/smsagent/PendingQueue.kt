package com.spidpay.smsagent

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * A tiny persisted queue for sms-ingest payloads that couldn't be sent
 * immediately (usually: phone had no internet at the moment the SMS
 * arrived). Backed by SharedPreferences since the volume is tiny
 * (a handful of pending items at most) — no need for a real database.
 */
object PendingQueue {
    private const val PREFS = "spidpay_pending_queue"
    private const val KEY_ITEMS = "items"

    fun add(context: Context, payload: JSONObject) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = JSONArray(prefs.getString(KEY_ITEMS, "[]"))
        current.put(payload)
        prefs.edit().putString(KEY_ITEMS, current.toString()).apply()
    }

    fun peekAll(context: Context): List<JSONObject> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY_ITEMS, "[]"))
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }

    /** Replace the queue with only the items that still need retrying. */
    fun setAll(context: Context, remaining: List<JSONObject>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray()
        remaining.forEach { arr.put(it) }
        prefs.edit().putString(KEY_ITEMS, arr.toString()).apply()
    }

    fun size(context: Context): Int = peekAll(context).size
}
