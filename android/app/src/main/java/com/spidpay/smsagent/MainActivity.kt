package com.spidpay.smsagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.material.button.MaterialButton
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var inputApiBase: EditText
    private lateinit var inputApiKey: EditText
    private lateinit var inputWebhookSecret: EditText
    private lateinit var statusText: TextView
    private lateinit var statusDot: android.view.View

    private val smsPermissionRequestCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!Config.isSetupComplete(this)) {
            startActivity(Intent(this, com.spidpay.smsagent.wizard.WizardActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        inputApiBase = findViewById(R.id.inputApiBase)
        inputApiKey = findViewById(R.id.inputApiKey)
        inputWebhookSecret = findViewById(R.id.inputWebhookSecret)
        statusText = findViewById(R.id.statusText)
        statusDot = findViewById(R.id.statusDot)

        inputApiBase.setText(Config.getApiBase(this))
        inputApiKey.setText(Config.getApiKey(this))
        inputWebhookSecret.setText(Config.getWebhookSecret(this))

        findViewById<MaterialButton>(R.id.btnSave).setOnClickListener { saveSettings() }
        findViewById<MaterialButton>(R.id.btnRequestPermission).setOnClickListener { requestSmsPermission() }

        schedulePeriodicRetry()
        refreshStatus()
    }

    private fun schedulePeriodicRetry() {
        val request = PeriodicWorkRequestBuilder<RetryWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "spipay_retry_queue",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    private fun saveSettings() {
        val apiBase = inputApiBase.text.toString().trim()
        val apiKey = inputApiKey.text.toString().trim()
        val secret = inputWebhookSecret.text.toString().trim()

        if (apiKey.isBlank() || secret.isBlank()) {
            Toast.makeText(this, "API Key এবং Webhook Secret দুটোই দরকার", Toast.LENGTH_SHORT).show()
            return
        }

        val hasPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED

        Config.save(this, apiBase, apiKey, secret, enabled = hasPermission)
        Toast.makeText(this, "সেভ হয়েছে", Toast.LENGTH_SHORT).show()
        refreshStatus()
    }

    private fun requestSmsPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
            smsPermissionRequestCode
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == smsPermissionRequestCode) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted && Config.isConfigured(this)) {
                Config.save(
                    this,
                    Config.getApiBase(this),
                    Config.getApiKey(this),
                    Config.getWebhookSecret(this),
                    enabled = true
                )
            }
            Toast.makeText(
                this,
                if (granted) "অনুমতি দেওয়া হয়েছে" else "অনুমতি ছাড়া SMS পড়া যাবে না",
                Toast.LENGTH_SHORT
            ).show()
            refreshStatus()
        }
    }

    private fun refreshStatus() {
        val hasPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val (label, colorRes) = when {
            !Config.isConfigured(this) -> "সেটআপ বাকি আছে" to R.color.text_secondary
            !hasPermission -> "SMS অনুমতি দরকার" to R.color.pending
            Config.isEnabled(this) -> "চালু আছে, SMS শোনা হচ্ছে" to R.color.success
            else -> "বন্ধ আছে" to R.color.failed
        }

        statusText.text = label
        statusText.setTextColor(ContextCompat.getColor(this, colorRes))
        (statusDot.background as? GradientDrawable)?.setColor(ContextCompat.getColor(this, colorRes))
    }
}
