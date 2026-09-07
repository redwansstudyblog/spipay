package com.spidpay.smsagent.wizard

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.spidpay.smsagent.Config
import com.spidpay.smsagent.R
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException

class BackendConnectionFragment : Fragment(R.layout.fragment_backend_connection) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val inputApiBase = view.findViewById<TextInputEditText>(R.id.inputApiBase)
        val inputApiKey = view.findViewById<TextInputEditText>(R.id.inputApiKey)
        val inputWebhookSecret = view.findViewById<TextInputEditText>(R.id.inputWebhookSecret)
        val resultCard = view.findViewById<MaterialCardView>(R.id.resultCard)
        val resultText = view.findViewById<TextView>(R.id.resultText)
        val btnTest = view.findViewById<MaterialButton>(R.id.btnTestConnection)
        val btnNext = view.findViewById<MaterialButton>(R.id.btnNext)

        inputApiBase.setText(Config.getApiBase(requireContext()))
        inputApiKey.setText(Config.getApiKey(requireContext()))
        inputWebhookSecret.setText(Config.getWebhookSecret(requireContext()))

        btnTest.setOnClickListener {
            val apiBase = inputApiBase.text.toString().trim()
            val apiKey = inputApiKey.text.toString().trim()
            val secret = inputWebhookSecret.text.toString().trim()

            if (apiBase.isBlank() || apiKey.isBlank() || secret.isBlank()) {
                resultCard.visibility = View.VISIBLE
                resultText.text = "সব ফিল্ড পূরণ করুন"
                btnNext.isEnabled = false
                return@setOnClickListener
            }

            btnTest.isEnabled = false
            btnTest.text = "যাচাই করা হচ্ছে..."

            val client = OkHttpClient()
            val request = Request.Builder()
                .url("$apiBase/verify-api-key")
                .addHeader("x-api-key", apiKey)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    activity?.runOnUiThread {
                        btnTest.isEnabled = true
                        btnTest.text = "Test Connection"
                        resultCard.visibility = View.VISIBLE
                        resultText.text = "সার্ভারে পৌঁছানো যাচ্ছে না — URL চেক করুন"
                        btnNext.isEnabled = false
                    }
                }

                override fun onResponse(call: Call, response: okhttp3.Response) {
                    val body = response.body?.string().orEmpty()
                    val ok = try { JSONObject(body).optBoolean("ok", false) } catch (_e: Exception) { false }
                    val businessName = try { JSONObject(body).optString("business_name", "") } catch (_e: Exception) { "" }

                    activity?.runOnUiThread {
                        btnTest.isEnabled = true
                        btnTest.text = "Test Connection"
                        resultCard.visibility = View.VISIBLE
                        if (ok) {
                            resultText.text = "✓ Connection Successful — $businessName"
                            Config.saveBackend(requireContext(), apiBase, apiKey, secret, businessName)
                            btnNext.isEnabled = true
                        } else {
                            resultText.text = "✕ API Key ভুল বা যাচাই ব্যর্থ হয়েছে"
                            btnNext.isEnabled = false
                        }
                    }
                    response.close()
                }
            })
        }

        btnNext.setOnClickListener {
            (activity as? WizardActivity)?.goNext()
        }
    }
}
