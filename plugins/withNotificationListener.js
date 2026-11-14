const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'lifeos.notificationlistener.LifeOSNotificationListenerService';
const PACKAGE_NAME = 'lifeos.notificationlistener.LifeOSNotificationListenerPackage';

/**
 * 1. Config Plugin: Modifies AndroidManifest.xml
 */
function modifyAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // Check if service already exists
    const existing = mainApplication.service.find(
      (s) => s.$?.['android:name'] === SERVICE_NAME
    );

    if (!existing) {
      mainApplication.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': 'LifeOS Notification Listener',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

/**
 * 2. Config Plugin: Registers LifeOSNotificationListenerPackage in MainApplication.kt
 */
function modifyMainApplication(config) {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;

    // 1. Add import if not present
    if (!content.includes('import lifeos.notificationlistener.LifeOSNotificationListenerPackage')) {
      content = content.replace(
        /(package\s+[\w\.]+)/,
        `$1\n\nimport lifeos.notificationlistener.LifeOSNotificationListenerPackage`
      );
    }

    // 2. Add package to packageList
    if (!content.includes('LifeOSNotificationListenerPackage()')) {
      if (content.includes('PackageList(this).packages.apply {')) {
        content = content.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.toMutableList().apply {\n          add(LifeOSNotificationListenerPackage())'
        );
      } else if (content.includes('PackageList(this).packages')) {
        content = content.replace(
          'PackageList(this).packages',
          '(PackageList(this).packages.toMutableList().apply { add(LifeOSNotificationListenerPackage()) })'
        );
      }
    }

    config.modResults.contents = content;
    return config;
  });
}

/**
 * 3. Dangerous Mod: Injects Kotlin native source files during prebuild
 */
function injectNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'lifeos',
        'notificationlistener'
      );

      fs.mkdirSync(targetDir, { recursive: true });

      // Copy Kotlin source templates from project plugins/native/ directory
      const sourceDir = path.join(projectRoot, 'plugins', 'native');
      const files = [
        'LifeOSNotificationListenerService.kt',
        'LifeOSNotificationListenerModule.kt',
        'LifeOSNotificationListenerPackage.kt',
      ];

      for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(targetDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      return config;
    },
  ]);
}

/**
 * Root Config Plugin export
 */
module.exports = function withNotificationListener(config) {
  config = modifyAndroidManifest(config);
  config = modifyMainApplication(config);
  config = injectNativeFiles(config);
  return config;
};

