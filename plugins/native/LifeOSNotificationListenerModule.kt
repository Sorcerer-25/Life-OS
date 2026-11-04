package lifeos.notificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.util.HashSet

class LifeOSNotificationListenerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "LifeOSNotificationListener"
        const val EVENT_NOTIFICATION = "LifeOSNotificationReceived"
        const val EVENT_STATUS = "LifeOSListenerStatusChanged"

        private var instance: LifeOSNotificationListenerModule? = null

        fun emitNotification(eventJson: JSONObject): Boolean {
            val module = instance ?: return false
            val context = module.reactContext
            if (!context.hasActiveReactInstance()) return false

            val map = Arguments.createMap().apply {
                putString("notification_id", eventJson.optString("notification_id"))
                putString("source_app", eventJson.optString("source_app"))
                putString("app_label", eventJson.optString("app_label"))
                putString("title", eventJson.optString("title"))
                putString("text", eventJson.optString("text"))
                putString("posted_at", eventJson.optString("posted_at"))
                putString("category", eventJson.optString("category"))
            }

            try {
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_NOTIFICATION, map)
                return true
            } catch (_: Exception) {
                return false
            }
        }

        fun emitStatus(isConnected: Boolean) {
            val module = instance ?: return
            val context = module.reactContext
            if (!context.hasActiveReactInstance()) return

            val map = Arguments.createMap().apply {
                putBoolean("isConnected", isConnected)
            }
            try {
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_STATUS, map)
            } catch (_: Exception) {}
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        try {
            val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            val isGranted = enabledPackages.contains(reactContext.packageName)
            promise.resolve(isGranted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getListenerStatus(promise: Promise) {
        try {
            val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            val isPermissionGranted = enabledPackages.contains(reactContext.packageName)
            val prefs = LifeOSNotificationListenerService.getPreferences(reactContext)
            val isConnected = prefs.getBoolean(LifeOSNotificationListenerService.KEY_LISTENER_CONNECTED, false)
            val captureEnabled = prefs.getBoolean(LifeOSNotificationListenerService.KEY_CAPTURE_ENABLED, false)

            val rawQueue = prefs.getString(LifeOSNotificationListenerService.KEY_PENDING_QUEUE, "[]") ?: "[]"
            val queueSize = JSONArray(rawQueue).length()

            val map = Arguments.createMap().apply {
                putBoolean("isPermissionGranted", isPermissionGranted)
                putBoolean("isConnected", isConnected)
                putBoolean("captureEnabled", captureEnabled)
                putInt("queueSize", queueSize)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestRebind(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val service = LifeOSNotificationListenerService.activeListenerInstance
                if (service != null) {
                    service.requestRebind(ComponentName(reactContext, LifeOSNotificationListenerService::class.java))
                } else {
                    LifeOSNotificationListenerService.requestRebind(
                        ComponentName(reactContext, LifeOSNotificationListenerService::class.java)
                    )
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REBIND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateSettings(captureEnabled: Boolean, allowedApps: ReadableArray, promise: Promise) {
        try {
            val appSet = HashSet<String>()
            for (i in 0 until allowedApps.size()) {
                val app = allowedApps.getString(i)?.lowercase()
                if (app != null && app.isNotBlank() && !LifeOSNotificationListenerService.LIFEOS_PACKAGES.contains(app)) {
                    appSet.add(app)
                }
            }

            val prefs = LifeOSNotificationListenerService.getPreferences(reactContext)
            prefs.edit()
                .putBoolean(LifeOSNotificationListenerService.KEY_CAPTURE_ENABLED, captureEnabled)
                .putStringSet(LifeOSNotificationListenerService.KEY_ALLOWED_APPS, appSet)
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun drainPendingNotifications(promise: Promise) {
        synchronized(LifeOSNotificationListenerService::class.java) {
            try {
                val prefs = LifeOSNotificationListenerService.getPreferences(reactContext)
                val rawQueue = prefs.getString(LifeOSNotificationListenerService.KEY_PENDING_QUEUE, "[]") ?: "[]"
                val jsonArray = JSONArray(rawQueue)

                val resultList: WritableArray = Arguments.createArray()
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val map = Arguments.createMap().apply {
                        putString("notification_id", obj.optString("notification_id"))
                        putString("source_app", obj.optString("source_app"))
                        putString("app_label", obj.optString("app_label"))
                        putString("title", obj.optString("title"))
                        putString("text", obj.optString("text"))
                        putString("posted_at", obj.optString("posted_at"))
                        putString("category", obj.optString("category"))
                    }
                    resultList.pushMap(map)
                }

                // Clear the queue after reading
                prefs.edit().putString(LifeOSNotificationListenerService.KEY_PENDING_QUEUE, "[]").apply()
                promise.resolve(resultList)
            } catch (e: Exception) {
                promise.reject("DRAIN_ERROR", e.message, e)
            }
        }
    }
}

