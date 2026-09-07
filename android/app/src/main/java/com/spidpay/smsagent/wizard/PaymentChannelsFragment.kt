package com.spidpay.smsagent.wizard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.spidpay.smsagent.Config
import com.spidpay.smsagent.R

private data class ChannelDisplay(val id: String, val label: String, val colorRes: Int)

class PaymentChannelsFragment : Fragment(R.layout.fragment_payment_channels) {

    private val displayChannels = listOf(
        ChannelDisplay("bkash", "bKash", R.color.bkash),
        ChannelDisplay("nagad", "Nagad", R.color.nagad),
        ChannelDisplay("rocket", "Rocket", R.color.rocket),
        ChannelDisplay("upay", "Upay", R.color.upay),
    )

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val container = view.findViewById<LinearLayout>(R.id.channelList)
        val inflater = LayoutInflater.from(requireContext())

        displayChannels.forEach { channel ->
            val row = inflater.inflate(R.layout.item_channel_toggle, container, false)
            row.findViewById<TextView>(R.id.channelName).text = channel.label
            row.findViewById<View>(R.id.colorDot).background.setTint(resources.getColor(channel.colorRes, null))
            val switchView = row.findViewById<SwitchMaterial>(R.id.channelSwitch)
            switchView.isChecked = Config.isProviderEnabled(requireContext(), channel.id)
            switchView.setOnCheckedChangeListener { _, checked ->
                Config.setProviderEnabled(requireContext(), channel.id, checked)
            }
            container.addView(row)
        }

        view.findViewById<MaterialButton>(R.id.btnNext).setOnClickListener {
            (activity as? WizardActivity)?.goNext()
        }
    }
}
