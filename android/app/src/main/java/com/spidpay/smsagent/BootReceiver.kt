package com.spidpay.smsagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * The SmsReceiver above is a manifest-registered (static) receiver, so
 * Android already re-registers it automatically after a reboot without
 * this class doing anything. This is kept as a hook point in case a
 * future version needs to restart a foreground service or re-check
 * permissions right after boot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("SpidPayBootReceiver", "Device booted, SpidPay Agent is ready")
        }
    }
}
