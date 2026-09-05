package com.spidpay.smsagent

import android.content.Context
import android.content.SharedPreferences

/**
 * Everything is stored locally on-device via SharedPreferences.
 * Nothing here is synced anywhere except what SmsReceiver explicitly
 * sends to your own API base URL.
 */
object Config {
    private const val PREFS = "spidpay_agent_prefs"
    private const val KEY_API_BASE = "api_base"
    private const val KEY_API_KEY = "api_key"
    private const val KEY_WEBHOOK_SECRET = "webhook_secret"
    private const val KEY_ENABLED = "enabled"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getApiBase(context: Context): String =
        prefs(context).getString(KEY_API_BASE, "https://nihvxjmshnzxzffnrdst.supabase.co/functions/v1") ?: ""

    fun getApiKey(context: Context): String =
        prefs(context).getString(KEY_API_KEY, "") ?: ""

    fun getWebhookSecret(context: Context): String =
        prefs(context).getString(KEY_WEBHOOK_SECRET, "") ?: ""

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun save(context: Context, apiBase: String, apiKey: String, webhookSecret: String, enabled: Boolean) {
        prefs(context).edit()
            .putString(KEY_API_BASE, apiBase)
            .putString(KEY_API_KEY, apiKey)
            .putString(KEY_WEBHOOK_SECRET, webhookSecret)
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
    }

    fun isConfigured(context: Context): Boolean =
        getApiKey(context).isNotBlank() && getWebhookSecret(context).isNotBlank()
}
