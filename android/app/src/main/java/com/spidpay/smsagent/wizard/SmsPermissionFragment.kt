package com.spidpay.smsagent.wizard

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.spidpay.smsagent.R

class SmsPermissionFragment : Fragment(R.layout.fragment_sms_permission) {

    private val requestPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result[Manifest.permission.RECEIVE_SMS] == true
        updateStatus(granted)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val status = view.findViewById<TextView>(R.id.permStatus)
        val btnAllow = view.findViewById<MaterialButton>(R.id.btnAllow)
        val btnNext = view.findViewById<MaterialButton>(R.id.btnNext)

        val alreadyGranted = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED
        updateStatus(alreadyGranted)

        btnAllow.setOnClickListener {
            requestPermission.launch(arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS))
        }
        btnNext.setOnClickListener {
            (activity as? WizardActivity)?.goNext()
        }
    }

    private fun updateStatus(granted: Boolean) {
        val status = view?.findViewById<TextView>(R.id.permStatus) ?: return
        val btnNext = view?.findViewById<MaterialButton>(R.id.btnNext) ?: return
        if (granted) {
            status.text = "Permission Granted ✓"
            status.setTextColor(resources.getColor(com.spidpay.smsagent.R.color.success, null))
            btnNext.isEnabled = true
        } else {
            status.text = "অনুমতি দেওয়া হয়নি"
            btnNext.isEnabled = false
        }
    }
}
