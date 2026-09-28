package online.thaiai.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import androidx.annotation.RequiresApi;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * 壳自己的原生能力。只补网页在 WebView 里拿不到的那几件：
 *
 *   - openExternal：把外链/收银台丢给系统浏览器（WebView 里 window.open 打不开新窗口）
 *   - share：系统分享面板（WebView 没有 navigator.share，成就卡分享会退化成下载）
 *   - saveFile：保存图片/文件（WebView **没有**下载能力，`<a download>` 点了毫无反应）
 *   - appInfo：版本号给网页显示（判断壳版本是否需要更新）
 *
 * 刻意不装 @capacitor/share：为这一个动作引一整套插件不划算，
 * 而且分享图片要写到缓存目录再经 FileProvider 授权，自己写反而更清楚。
 */
@CapacitorPlugin(
    name = "Shell",
    // 存储权限只在 Android 9 及以下用得到（10+ 走 MediaStore 沙箱，不需要权限）。
    // 清单里这条权限带 maxSdkVersion=28，新系统连"声明"都看不到，不会吓到用户。
    permissions = {
        @Permission(alias = "storage", strings = { android.Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class ShellPlugin extends Plugin {

    /** 分享/保存的图片上限：base64 进内存再解码，太大容易 OOM（成就卡 2x 导出通常 < 3MB） */
    private static final int MAX_FILE_BYTES = 12 * 1024 * 1024;

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("no activity can open this url", e);
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        String title = call.getString("title", "");
        String text = call.getString("text", "");
        String url = call.getString("url", "");
        JSArray files = call.getArray("files");

        try {
            if (files != null && files.length() > 0) {
                shareFiles(call, title, text, files);
            } else {
                String body = url == null || url.isEmpty() ? text : (text + " " + url).trim();
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, body);
                if (title != null && !title.isEmpty()) {
                    send.putExtra(Intent.EXTRA_SUBJECT, title);
                }
                getActivity().startActivity(Intent.createChooser(send, title));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("share failed", e);
        }
    }

    /**
     * 保存网页给的图片/文件。
     *
     * 为什么必须原生做：Android WebView 默认**没有**下载能力，网页里
     * `const a = document.createElement("a"); a.download = "..."; a.href = canvas.toDataURL(); a.click()`
     * 这套写法在浏览器里能存图，在 WebView 里点了没有任何反应（既不报错也不保存）。
     * 站内的场景证书、学习成就图、世界明信片都走这条路，所以缺了它 App 里"保存"按钮等于坏的。
     *
     * 落盘位置：Android 10+ 走 MediaStore（进系统相册 / 下载，无需任何权限）；
     * Android 9 及以下写公共 Pictures 目录，需要一次性申请存储权限。
     */
    @PluginMethod
    public void saveFile(PluginCall call) {
        if (call.getString("dataUrl") == null || call.getString("dataUrl").isEmpty()) {
            call.reject("dataUrl is required");
            return;
        }
        // 10+ 由 MediaStore 托管，不需要权限；老系统才要问一次
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        writeToDisk(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("没有存储权限，无法保存到相册");
            return;
        }
        writeToDisk(call);
    }

    private void writeToDisk(PluginCall call) {
        try {
            String dataUrl = call.getString("dataUrl");
            String filename = resolveFilename(call.getString("filename", ""), dataUrl);
            String mime = resolveMime(dataUrl, filename);
            byte[] bytes = decodeDataUrl(dataUrl);
            if (bytes.length == 0) throw new IOException("文件内容为空");
            if (bytes.length > MAX_FILE_BYTES) throw new IOException("文件过大：" + bytes.length + " 字节");

            String location = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? writeViaMediaStore(filename, mime, bytes)
                : writeToPublicPictures(filename, mime, bytes);

            JSObject res = new JSObject();
            res.put("filename", filename);
            res.put("location", location);
            call.resolve(res);
            // WebView 里没有任何视觉反馈，原生弹一下用户才知道存进去了
            toast("已保存到" + location);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage(), e);
        }
    }

    /** MediaStore 落盘（Android 10+）：图片进相册，其它进「下载」，都不需要权限 */
    @RequiresApi(Build.VERSION_CODES.Q)
    private String writeViaMediaStore(String filename, String mime, byte[] bytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        boolean image = mime.startsWith("image/");
        Uri collection = image
            ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        String relativeDir = image
            ? Environment.DIRECTORY_PICTURES + "/ThaiAI"
            : Environment.DIRECTORY_DOWNLOADS + "/ThaiAI";

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativeDir);
        // IS_PENDING：写一半被其它应用（相册索引）读到会得到坏文件
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new IOException("系统拒绝了写入");
        try (OutputStream os = resolver.openOutputStream(uri)) {
            if (os == null) throw new IOException("打不开输出流");
            os.write(bytes);
        } catch (IOException e) {
            // 失败就把占位的空记录删掉，免得相册里留一张坏图
            resolver.delete(uri, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return image ? "相册（Pictures/ThaiAI）" : "下载（Download/ThaiAI）";
    }

    /** Android 9 及以下：写公共 Pictures 目录，并触发媒体扫描让相册立刻看到 */
    @SuppressWarnings("deprecation")
    private String writeToPublicPictures(String filename, String mime, byte[] bytes) throws IOException {
        File dir = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
            "ThaiAI"
        );
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("无法创建保存目录");
        File out = new File(dir, filename);
        try (FileOutputStream fos = new FileOutputStream(out)) {
            fos.write(bytes);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { out.getAbsolutePath() }, new String[] { mime }, null);
        return "相册（Pictures/ThaiAI）";
    }

    private void shareFiles(PluginCall call, String title, String text, JSArray files) throws Exception {
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("cannot create share cache dir");
        }
        // 分享完不复用这些文件：系统相册/微博类应用会重读，只保留最近 10 个，避免缓存无限增长
        java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();
        String authority = getContext().getPackageName() + ".fileprovider";

        for (int i = 0; i < files.length(); i++) {
            String payload = files.getString(i);
            if (payload == null || payload.isEmpty()) continue;
            int comma = payload.indexOf(',');
            String base64 = payload.startsWith("data:") && comma > 0 ? payload.substring(comma + 1) : payload;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > MAX_FILE_BYTES) {
                throw new IllegalArgumentException("shared file size out of range: " + bytes.length);
            }
            File out = new File(dir, "thaiai-share-" + System.currentTimeMillis() + "-" + i + guessExt(payload));
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(bytes);
            }
            uris.add(FileProvider.getUriForFile(getContext(), authority, out));
        }
        trimCache(dir);

        Intent send = new Intent(uris.size() > 1 ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
        send.setType("image/png");
        if (uris.size() > 1) {
            send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        } else {
            send.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        }
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (text != null && !text.isEmpty()) {
            send.putExtra(Intent.EXTRA_TEXT, text);
        }
        Intent chooser = Intent.createChooser(send, title);
        // chooser 也要授权，否则部分系统里接收方读到的是空文件
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(chooser);
    }

    /** data:image/jpeg;base64 这类前缀里取扩展名，取不到就按 png 存 */
    private String guessExt(String payload) {
        if (payload.startsWith("data:image/jpeg") || payload.startsWith("data:image/jpg")) return ".jpg";
        if (payload.startsWith("data:image/webp")) return ".webp";
        return ".png";
    }

    /** 从 data URL 里取出 base64 正文并解码 */
    private byte[] decodeDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        String base64 = dataUrl.startsWith("data:") && comma > 0
            ? dataUrl.substring(comma + 1)
            : dataUrl;
        return Base64.decode(base64, Base64.DEFAULT);
    }

    /** data URL 的 MIME；没有前缀就按文件名后缀猜 */
    private String resolveMime(String dataUrl, String filename) {
        if (dataUrl.startsWith("data:")) {
            int end = dataUrl.indexOf(';');
            if (end < 0) end = dataUrl.indexOf(',');
            if (end > 5) {
                String mime = dataUrl.substring(5, end).trim();
                if (!mime.isEmpty() && mime.contains("/")) return mime;
            }
        }
        String lower = filename.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".pdf")) return "application/pdf";
        return "image/png";
    }

    /**
     * 文件名兜底与清洗：网页给的名字可能是空的，也可能带 `/`（如场景标题里的斜杠），
     * 后者会让 MediaStore 直接拒绝写入。
     */
    private String resolveFilename(String raw, String dataUrl) {
        String name = raw == null ? "" : raw.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", "_").replaceAll("^[.\\s]+", "");
        if (name.isEmpty()) name = "thaiai-" + System.currentTimeMillis();
        if (name.length() > 96) {
            int dot = name.lastIndexOf('.');
            name = dot > 0 ? name.substring(0, 90) + name.substring(dot) : name.substring(0, 96);
        }
        if (!name.contains(".")) {
            String mime = resolveMime(dataUrl, "x.png");
            name += mime.endsWith("jpeg") ? ".jpg" : mime.endsWith("webp") ? ".webp" : ".png";
        }
        return name;
    }

    private void toast(String message) {
        try {
            getActivity().runOnUiThread(
                () -> Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show()
            );
        } catch (Exception ignored) {
            // 弹不出来不影响保存结果
        }
    }

    private void trimCache(File dir) {
        File[] olds = dir.listFiles();
        if (olds == null || olds.length <= 10) return;
        java.util.Arrays.sort(olds, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        for (int i = 10; i < olds.length; i++) {
            // 删不掉也无所谓：缓存目录系统会清
            //noinspection ResultOfMethodCallIgnored
            olds[i].delete();
        }
    }

    @PluginMethod
    public void appInfo(PluginCall call) {
        JSObject info = new JSObject();
        String name = getContext().getPackageName();
        info.put("platform", "android");
        info.put("packageName", name);
        try {
            android.content.pm.PackageInfo pkg = getContext().getPackageManager().getPackageInfo(name, 0);
            info.put("versionName", pkg.versionName == null ? "" : pkg.versionName);
            info.put("versionCode", android.os.Build.VERSION.SDK_INT >= 28 ? pkg.getLongVersionCode() : pkg.versionCode);
            info.put("targetSdk", pkg.applicationInfo != null ? pkg.applicationInfo.targetSdkVersion : 0);
        } catch (Exception e) {
            info.put("versionName", "");
            info.put("versionCode", 0);
        }
        info.put("sdk", android.os.Build.VERSION.SDK_INT);
        call.resolve(info);
    }

    /** 网页里的「退出登录」不该关 App，所以这个仅用于明确的退出按钮 */
    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().finish();
    }
}
