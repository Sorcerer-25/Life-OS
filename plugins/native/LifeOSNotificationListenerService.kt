package lifeos.notificationlistener

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class LifeOSNotificationListenerService : NotificationListenerService() {

    companion object {
        const val PREFS_NAME = "lifeos_notification_prefs"
        const val KEY_CAPTURE_ENABLED = "capture_enabled"
        const val KEY_ALLOWED_APPS = "allowed_apps"
        const val KEY_PENDING_QUEUE = "pending_notifications_queue"
        const val KEY_LISTENER_CONNECTED = "listener_connected"
        const val MAX_QUEUE_SIZE = 50

        // LifeOS own package names to prevent loops
        val LIFEOS_PACKAGES = setOf(
            "com.lifeos",
            "com.lifeos.app",
            "lifeos",
            "lifeos-temp",
            "host.exp.exponent",
            "com.anonymous.lifeostemp"
        )

        var activeListenerInstance: LifeOSNotificationListenerService? = null

        fun getPreferences(context: Context) =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun isConnected(context: Context): Boolean =
            getPreferences(context).getBoolean(KEY_LISTENER_CONNECTED, false)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        activeListenerInstance = this
        getPreferences(this).edit().putBoolean(KEY_LISTENER_CONNECTED, true).apply()
        LifeOSNotificationListenerModule.emitStatus(true)
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        activeListenerInstance = null
        getPreferences(this).edit().putBoolean(KEY_LISTENER_CONNECTED, false).apply()
        LifeOSNotificationListenerModule.emitStatus(false)
        // Request rebind as required
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            requestRebind(ComponentName(this, LifeOSNotificationListenerService::class.java))
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val prefs = getPreferences(this)
        val captureEnabled = prefs.getBoolean(KEY_CAPTURE_ENABLED, false)
        if (!captureEnabled) return

        val pkgName = sbn.packageName?.lowercase(Locale.ROOT) ?: return

        // 1. Drop LifeOS own notifications to prevent loop with Reminder Agent
        if (LIFEOS_PACKAGES.contains(pkgName) || pkgName == applicationContext.packageName.lowercase(Locale.ROOT)) {
            return
        }

        // 2. Drop ongoing notifications
        val notification = sbn.notification ?: return
        if (sbn.isOngoing || (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0) {
            return
        }

        // 3. Drop group summaries
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) {
            return
        }

        // 4. Drop media and background service notifications
        val category = notification.category ?: ""
        if (category == "transport" || category == "media" || category == Notification.CATEGORY_TRANSPORT || category == Notification.CATEGORY_SERVICE) {
            return
        }

        // 5. Apply user allow-list filter
        val allowedApps = prefs.getStringSet(KEY_ALLOWED_APPS, emptySet()) ?: emptySet()
        if (!allowedApps.contains(pkgName)) {
            return
        }

        // 6. Extract only package, title, text, post time, and category
        val extras = notification.extras
        val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: ""
        val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim() ?: ""

        if (title.isEmpty() && text.isEmpty()) {
            return
        }

        var appLabel = pkgName
        try {
            val pm = applicationContext.packageManager
            val appInfo = pm.getApplicationInfo(pkgName, 0)
            appLabel = pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {}

        val postTimeMs = sbn.postTime
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val postTimeIso = sdf.format(Date(postTimeMs))

        val notifId = "${sbn.id}_${sbn.tag ?: ""}_$postTimeMs"

        val eventJson = JSONObject().apply {
            put("notification_id", notifId)
            put("source_app", pkgName)
            put("app_label", appLabel)
            put("title", title)
            put("text", text)
            put("posted_at", postTimeIso)
            put("category", category)
        }

        // NO notification content logged in release builds
        // If app is currently running in foreground with JS listening, deliver immediately
        LifeOSNotificationListenerModule.emitNotification(eventJson)

        // Also append to persistent queue in SharedPreferences for background drain
        appendToQueue(prefs, eventJson)
    }

    private fun appendToQueue(prefs: android.content.SharedPreferences, eventJson: JSONObject) {
        synchronized(LifeOSNotificationListenerService::class.java) {
            try {
                val rawQueue = prefs.getString(KEY_PENDING_QUEUE, "[]") ?: "[]"
                val jsonArray = JSONArray(rawQueue)

                // Limit queue size to MAX_QUEUE_SIZE
                while (jsonArray.length() >= MAX_QUEUE_SIZE) {
                    jsonArray.remove(0)
                }
                jsonArray.put(eventJson)

                prefs.edit().putString(KEY_PENDING_QUEUE, jsonArray.toString()).apply()
            } catch (_: Exception) {}
        }
    }
}

