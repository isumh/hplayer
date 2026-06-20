# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor 插件注解与方法保持
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }

# Cordova 插件保持
-keep public class * extends org.apache.cordova.* {
  public <methods>;
  public <fields>;
}

# 第三方 Capacitor 插件（SQLite、视频播放器等）按需保持
-keep public class com.capacitorjs.** { *; }
-keep public class com.capgo.** { *; }
-keep public class io.liteglue.** { *; }
-keep public class com.getcapacitor.community.** { *; }
-keep public class com.capawesome.** { *; }
