package com.spidpay.smsagent.wizard

import android.os.Bundle
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import com.spidpay.smsagent.R

class WizardActivity : AppCompatActivity() {

    private lateinit var pager: ViewPager2
    private lateinit var dotsRow: LinearLayout

    private val steps: List<() -> Fragment> = listOf(
        { WelcomeFragment() },
        { BackendConnectionFragment() },
        { SmsPermissionFragment() },
        { PaymentChannelsFragment() },
        { SetupCompleteFragment() },
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_wizard)

        pager = findViewById(R.id.wizardPager)
        dotsRow = findViewById(R.id.dotsRow)

        pager.adapter = object : FragmentStateAdapter(this as FragmentActivity) {
            override fun getItemCount() = steps.size
            override fun createFragment(position: Int) = steps[position]()
        }

        pager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                renderDots(position)
            }
        })

        renderDots(0)
    }

    fun goNext() {
        if (pager.currentItem < steps.size - 1) {
            pager.setCurrentItem(pager.currentItem + 1, true)
        }
    }

    fun goBack() {
        if (pager.currentItem > 0) {
            pager.setCurrentItem(pager.currentItem - 1, true)
        }
    }

    private fun renderDots(activeIndex: Int) {
        // Welcome and Setup Complete screens don't show step dots (matches the design doc)
        if (activeIndex == 0 || activeIndex == steps.size - 1) {
            dotsRow.removeAllViews()
            return
        }
        dotsRow.removeAllViews()
        val dotSize = (8 * resources.displayMetrics.density).toInt()
        val margin = (4 * resources.displayMetrics.density).toInt()
        for (i in 1 until steps.size - 1) {
            val dot = android.view.View(this)
            val params = LinearLayout.LayoutParams(dotSize, dotSize)
            params.setMargins(margin, 0, margin, 0)
            dot.layoutParams = params
            dot.setBackgroundResource(if (i == activeIndex) R.drawable.dot_active else R.drawable.dot_inactive)
            dotsRow.addView(dot)
        }
    }
}
