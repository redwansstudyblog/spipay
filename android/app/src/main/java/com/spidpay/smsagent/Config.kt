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
    private const val KEY_SETUP_COMPLETE = "setup_complete"
    private const val KEY_BUSINESS_NAME = "business_name"

    val ALL_PROVIDERS = listOf("bkash", "nagad", "rocket", "upay", "tap", "cellfin", "surecash", "okwallet", "mcash", "meghnapay")

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getApiBase(context: Context): String =
        prefs(context).getString(KEY_API_BASE, "https://nihvxjmshnzxzffnrdst.supabase.co/functions/v1") ?: ""

    fun getApiKey(context: Context): String =
        prefs(context).getString(KEY_API_KEY, "") ?: ""

    fun getWebhookSecret(context: Context): String =
        prefs(context).getString(KEY_WEBHOOK_SECRET, "") ?: ""

    fun getBusinessName(context: Context): String =
        prefs(context).getString(KEY_BUSINESS_NAME, "") ?: ""

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun isSetupComplete(context: Context): Boolean =
        prefs(context).getBoolean(KEY_SETUP_COMPLETE, false)

    fun saveBackend(context: Context, apiBase: String, apiKey: String, webhookSecret: String, businessName: String) {
        prefs(context).edit()
            .putString(KEY_API_BASE, apiBase)
            .putString(KEY_API_KEY, apiKey)
            .putString(KEY_WEBHOOK_SECRET, webhookSecret)
            .putString(KEY_BUSINESS_NAME, businessName)
            .apply()
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun setSetupComplete(context: Context, complete: Boolean) {
        prefs(context).edit().putBoolean(KEY_SETUP_COMPLETE, complete).apply()
    }

    // --- Per-provider channel toggle (local to this device) ---
    // Default: bKash/Nagad/Rocket on, others off, matching the wizard mockup.
    fun isProviderEnabled(context: Context, provider: String): Boolean {
        val default = provider in setOf("bkash", "nagad", "rocket")
        return prefs(context).getBoolean("channel_$provider", default)
    }

    fun setProviderEnabled(context: Context, provider: String, enabled: Boolean) {
        prefs(context).edit().putBoolean("channel_$provider", enabled).apply()
    }

    fun isConfigured(context: Context): Boolean =
        getApiKey(context).isNotBlank() && getWebhookSecret(context).isNotBlank()

    // Backward-compatible alias used by RetryWorker/MainActivity
    fun save(context: Context, apiBase: String, apiKey: String, webhookSecret: String, enabled: Boolean) {
        saveBackend(context, apiBase, apiKey, webhookSecret, getBusinessName(context))
        setEnabled(context, enabled)
    }
}
