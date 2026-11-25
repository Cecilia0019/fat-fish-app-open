package com.fatfish.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.text.InputType;
import android.view.View;
import android.view.Window;
import android.view.inputmethod.EditorInfo;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final String PREFS = "fish";
    private static final String KEY_URL = "server_url";
    private static final int FILE_REQ = 1001;
    private static final int AUDIO_REQ = 1002;
    private static final int VOICE_REQ = 1003;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingAudioPermission;
    private String currentUrl = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(242, 244, 247));
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        String saved = prefs().getString(KEY_URL, "");
        if (saved == null || saved.trim().isEmpty()) {
            showSetup();
        } else {
            loadApp(saved.trim());
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showSetup() {
        if (webView != null) {
            try {
                webView.destroy();
            } catch (Exception ignored) {
            }
            webView = null;
        }

        String saved = prefs().getString(KEY_URL, "");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(42), dp(24), dp(24));
        root.setBackgroundColor(Color.rgb(242, 244, 247));

        TextView title = new TextView(this);
        title.setText("大肥鱼");
        title.setTextSize(28);
        title.setTextColor(Color.rgb(17, 24, 32));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("手机端 · 先填入电脑上的地址");
        subtitle.setTextSize(13);
        subtitle.setTextColor(Color.rgb(107, 122, 137));
        subtitle.setPadding(0, dp(6), 0, dp(24));
        root.addView(subtitle);

        EditText input = new EditText(this);
        input.setText(saved == null ? "" : saved);
        input.setHint("https://你的地址/?token=...");
        input.setTextSize(13);
        input.setTextColor(Color.rgb(17, 24, 32));
        input.setHintTextColor(Color.rgb(152, 166, 179));
        input.setBackgroundColor(Color.WHITE);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setSingleLine(false);
        input.setMinLines(3);
        input.setMaxLines(6);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        root.addView(input, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        Button connect = new Button(this);
        connect.setText("进入");
        connect.setAllCaps(false);
        connect.setTextSize(15);
        connect.setTextColor(Color.WHITE);
        connect.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0, 153, 255)));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        buttonParams.topMargin = dp(16);
        root.addView(connect, buttonParams);
        connect.setOnClickListener(v -> {
            String url = input.getText().toString().trim();
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                Toast.makeText(this, "地址要以 http:// 或 https:// 开头", Toast.LENGTH_SHORT).show();
                return;
            }
            prefs().edit().putString(KEY_URL, url).apply();
            loadApp(url);
        });

        TextView hint = new TextView(this);
        hint.setText("地址在电脑上的 data\\tunnel.url 里，整条复制过来（包含 ?token=）。\n这个地址只保存在本机。");
        hint.setTextSize(12);
        hint.setTextColor(Color.rgb(139, 153, 167));
        hint.setPadding(0, dp(18), 0, 0);
        root.addView(hint);

        setContentView(root);
    }

    private void showConnectionError(int status, String detail) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(48), dp(24), dp(24));
        root.setBackgroundColor(Color.rgb(242, 244, 247));

        TextView title = new TextView(this);
        title.setText("连不上她");
        title.setTextSize(26);
        title.setTextColor(Color.rgb(17, 24, 32));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        String reason;
        if (status == 530) {
            reason = "Cloudflare 隧道没有连上。电脑上的 cloudflared 可能停了，或者本机网关没开。";
        } else if (status == 401 || status == 403) {
            reason = "地址里的令牌不对或已失效。重新复制电脑上 data\\tunnel.url 的整条地址。";
        } else if (status > 0) {
            reason = "服务器返回了 HTTP " + status + "。检查电脑上的网关和隧道。";
        } else {
            reason = "网络打不开这个地址。检查手机网络、电脑是否开机、隧道是否在跑。";
        }
        subtitle.setText(reason);
        subtitle.setTextSize(14);
        subtitle.setTextColor(Color.rgb(70, 84, 98));
        subtitle.setLineSpacing(dp(3), 1f);
        subtitle.setPadding(0, dp(12), 0, dp(8));
        root.addView(subtitle);

        if (status > 0) {
            TextView code = new TextView(this);
            code.setText("HTTP " + status);
            code.setTextSize(11);
            code.setTextColor(Color.rgb(152, 166, 179));
            root.addView(code);
        }

        if (detail != null && !detail.trim().isEmpty()) {
            TextView detailView = new TextView(this);
            detailView.setText(detail);
            detailView.setTextSize(11);
            detailView.setTextColor(Color.rgb(152, 166, 179));
            detailView.setPadding(0, dp(8), 0, 0);
            root.addView(detailView);
        }

        Button retry = new Button(this);
        retry.setText("重试");
        retry.setAllCaps(false);
        retry.setTextSize(15);
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0, 153, 255)));
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        retryParams.topMargin = dp(22);
        root.addView(retry, retryParams);
        retry.setOnClickListener(v -> loadApp(currentUrl));

        Button setup = new Button(this);
        setup.setText("重新填地址");
        setup.setAllCaps(false);
        setup.setTextSize(15);
        setup.setTextColor(Color.rgb(17, 24, 32));
        setup.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.WHITE));
        LinearLayout.LayoutParams setupParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        setupParams.topMargin = dp(10);
        root.addView(setup, setupParams);
        setup.setOnClickListener(v -> showSetup());

        TextView hint = new TextView(this);
        hint.setText("地址在电脑上的 data\\tunnel.url 里，整条复制过来（包含 ?token=）。\nQuick Tunnel 每次重启地址会变，换地址后重新填一次就好。");
        hint.setTextSize(12);
        hint.setTextColor(Color.rgb(139, 153, 167));
        hint.setLineSpacing(dp(2), 1f);
        hint.setPadding(0, dp(18), 0, 0);
        root.addView(hint);

        setContentView(root);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void loadApp(String url) {
        currentUrl = url;
        if (webView == null) {
            webView = new WebView(this);
            webView.setBackgroundColor(Color.WHITE);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setUserAgentString(settings.getUserAgentString() + " FatFishApp/0.3.0");

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return handleUrl(request.getUrl());
                }

                @Override
                @SuppressWarnings("deprecation")
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return handleUrl(Uri.parse(url));
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request.isForMainFrame()) {
                        runOnUiThread(() -> showConnectionError(0,
                                error == null ? "" : String.valueOf(error.getDescription())));
                    }
                }

                @Override
                public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                                WebResourceResponse response) {
                    if (request.isForMainFrame() && response != null && response.getStatusCode() >= 400) {
                        int status = response.getStatusCode();
                        runOnUiThread(() -> showConnectionError(status, ""));
                    }
                }
            });

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                 FileChooserParams params) {
                    if (fileCallback != null) {
                        fileCallback.onReceiveValue(null);
                    }
                    fileCallback = callback;
                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                    try {
                        startActivityForResult(Intent.createChooser(intent, "选择图片"), FILE_REQ);
                        return true;
                    } catch (Exception error) {
                        fileCallback = null;
                        return false;
                    }
                }

                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        boolean wantsAudio = false;
                        for (String resource : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                                wantsAudio = true;
                                break;
                            }
                        }
                        if (!wantsAudio) {
                            request.deny();
                            return;
                        }
                        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                        } else {
                            pendingAudioPermission = request;
                            requestPermissions(
                                    new String[]{android.Manifest.permission.RECORD_AUDIO}, AUDIO_REQ);
                        }
                    });
                }
            });

            webView.addJavascriptInterface(new Bridge(), "FishNative");
        }

        setContentView(webView);
        webView.loadUrl(url);
        webView.requestFocus();
    }

    private boolean handleUrl(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https")) {
            if (isAppHost(uri.getHost())) return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
        }
        return true;
    }

    private boolean isAppHost(String host) {
        if (host == null) return false;
        try {
            String appHost = Uri.parse(currentUrl).getHost();
            return appHost != null && appHost.equalsIgnoreCase(host);
        } catch (Exception ignored) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == VOICE_REQ) {
            if (resultCode == RESULT_OK && data != null && webView != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (results != null && !results.isEmpty()) {
                    String text = results.get(0);
                    String script = "window.FishNativeVoice && window.FishNativeVoice("
                            + org.json.JSONObject.quote(text) + ");";
                    webView.evaluateJavascript(script, null);
                }
            }
            return;
        }
        if (requestCode != FILE_REQ) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == AUDIO_REQ) {
            if (pendingAudioPermission != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingAudioPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingAudioPermission.deny();
                }
                pendingAudioPermission = null;
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try {
                webView.destroy();
            } catch (Exception ignored) {
            }
            webView = null;
        }
        super.onDestroy();
    }

    public class Bridge {
        @JavascriptInterface
        public void back() {
            runOnUiThread(() -> {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            });
        }

        @JavascriptInterface
        public void openSetup() {
            runOnUiThread(MainActivity.this::showSetup);
        }

        @JavascriptInterface
        public void startVoiceInput() {
            runOnUiThread(() -> {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "说吧，我在听");
                try {
                    startActivityForResult(intent, VOICE_REQ);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this,
                            "手机没有可用的语音识别服务，先打字吧", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public String version() {
            return "z0.1.0";
        }
    }
}
