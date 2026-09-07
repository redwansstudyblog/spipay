package com.spidpay.smsagent.wizard

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.spidpay.smsagent.Config
import com.spidpay.smsagent.MainActivity
import com.spidpay.smsagent.R
import android.content.Intent

class SetupCompleteFragment : Fragment(R.layout.fragment_setup_complete) {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        view.findViewById<MaterialButton>(R.id.btnGoToDashboard).setOnClickListener {
            Config.setSetupComplete(requireContext(), true)
            Config.setEnabled(requireContext(), true)
            startActivity(Intent(requireContext(), MainActivity::class.java))
            activity?.finish()
        }
    }
}
