package online.thaiai.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 必须在 super.onCreate 之前：BridgeActivity 在 onCreate 里才把所有插件交给 Bridge
        registerPlugin(ShellPlugin.class);
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();

        // 泰语朗读、课文音频、视频在页面加载后自动播放时不会被系统静音拦截。
        // WebView 默认要求「用户手势」才允许出声，而站内很多音频是进入页面就播的。
        settings.setMediaPlaybackRequiresUserGesture(false);

        // 调试构建才开远程调试；正式包必须关掉（否则任何人插上电脑就能看到登录态）
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // 录音（AI 跟读打分）需要系统授权：Capacitor 的 WebChromeClient 会处理
        // onPermissionRequest，只要清单里声明了权限，Android 就会弹出授权框，
        // 这里不需要自己写一套 requestPermissions。

        // WebView 天生「不会下载」：页面里 `<a download href="https://...">` 这类链接
        // 点下去既不保存也不报错。这里把 http(s) 交给系统（浏览器/下载管理器）。
        // data:/blob: 不进这个分支 —— 那类内容原生读不到，由网页侧 nativeShell.js
        // 掉头调用 Shell.saveFile 保存（见 ShellPlugin.java）。
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url == null) return;
            if (!url.startsWith("http://") && !url.startsWith("https://")) return;
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                webView.getContext().startActivity(intent);
            } catch (Exception ignored) {
                // 没有浏览器可接手也不让 WebView 停在空白页
            }
        });
    }

    /**
     * 返回键交给 WebView 历史：BridgeActivity 没有覆写 onBackPressed，系统默认行为会
     * 直接退出 App；用户从首页深入几层后按一次返回就直接退出会很难受。
     *
     * 这里刻意只走传统 onBackPressed 路径：predictive back（OnBackInvokedCallback）
     * 需要清单里显式 enableOnBackInvokedCallback，targetSdk 34 默认不开。
     */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        Bridge bridge = getBridge();
        WebView webView = bridge == null ? null : bridge.getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
