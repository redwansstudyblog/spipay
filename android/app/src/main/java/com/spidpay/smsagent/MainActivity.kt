package com.spidpay.smsagent

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var inputApiBase: EditText
    private lateinit var inputApiKey: EditText
    private lateinit var inputWebhookSecret: EditText
    private lateinit var statusText: TextView

    private val smsPermissionRequestCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        inputApiBase = findViewById(R.id.inputApiBase)
        inputApiKey = findViewById(R.id.inputApiKey)
        inputWebhookSecret = findViewById(R.id.inputWebhookSecret)
        statusText = findViewById(R.id.statusText)

        inputApiBase.setText(Config.getApiBase(this))
        inputApiKey.setText(Config.getApiKey(this))
        inputWebhookSecret.setText(Config.getWebhookSecret(this))

        findViewById<Button>(R.id.btnSave).setOnClickListener { saveSettings() }
        findViewById<Button>(R.id.btnRequestPermission).setOnClickListener { requestSmsPermission() }

        refreshStatus()
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

        statusText.text = when {
            !Config.isConfigured(this) -> "স্ট্যাটাস: সেটআপ বাকি আছে"
            !hasPermission -> "স্ট্যাটাস: SMS অনুমতি দরকার"
            Config.isEnabled(this) -> "স্ট্যাটাস: চালু আছে, SMS শোনা হচ্ছে ✅"
            else -> "স্ট্যাটাস: বন্ধ আছে"
        }
    }
}
