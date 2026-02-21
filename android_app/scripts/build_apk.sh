#!/bin/bash

# Configuration
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "Using ANDROID_HOME: $ANDROID_HOME"

# 1. Accept Licenses
echo "y" | sdkmanager --sdk_root=$ANDROID_HOME --licenses

# 2. Install required components
echo "Installing platforms;android-34, build-tools;34.0.0, and ndk;27.1.12297006..."
sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-34" "build-tools;34.0.0" "ndk;27.1.12297006"

# 3. Create local.properties
echo "sdk.dir=$ANDROID_HOME" > /Users/kishnakushwaha/Documents/interview_helper/desier-ai/android_app/android/local.properties

# 4. Manual JS Bundling (Prevents "App keeps stopping" due to missing JS)
echo "Bundling JavaScript..."
mkdir -p android/app/src/main/assets
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

# 5. Run build
cd /Users/kishnakushwaha/Documents/interview_helper/desier-ai/android_app/android
./gradlew clean
./gradlew assembleRelease

# 6. Rename APK
VERSION=${1:-"latest"}
cd app/build/outputs/apk/release
mv app-release.apk "app-release-v${VERSION}.apk"
echo "✅ Build complete! APK saved as: app/build/outputs/apk/release/app-release-v${VERSION}.apk"
