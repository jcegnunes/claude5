import JSZip from 'jszip';

/**
 * JVM Dielectric Lab - USB Developer Mode & ADB Installation Service
 * Provides ADB scripts generator, Android native manifests, instructions,
 * and offline USB deployment packages with full Android Studio / Gradle APK project generator.
 */

export interface USBDeviceStatus {
  connected: boolean;
  deviceName?: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  manufacturerName?: string;
  errorMessage?: string;
  isIframeRestricted?: boolean;
}

export class USBInstallerService {
  /**
   * Check if WebUSB API is supported by the current browser and whether execution is in an iframe
   */
  public static isWebUSBSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  public static isInsideIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Safe USB detection with graceful fallback for iframe Permissions Policy restrictions
   */
  public static async requestAndroidUSBDevice(): Promise<USBDeviceStatus> {
    if (!this.isWebUSBSupported()) {
      return {
        connected: false,
        errorMessage: 'A API WebUSB não está disponível neste navegador. Utilize os scripts ADB USB (.bat / .sh) fornecidos abaixo.'
      };
    }

    if (this.isInsideIframe()) {
      return {
        connected: false,
        isIframeRestricted: true,
        errorMessage: 'O navegador bloqueia o acesso direto à porta USB dentro do modo de visualização (iframe). Abra o app em uma nova aba do navegador ou execute o instalador USB (.bat / .sh) diretamente no computador.'
      };
    }

    try {
      // @ts-expect-error navigator.usb is standard in Chromium
      const device = await navigator.usb.requestDevice({
        filters: []
      });

      if (!device) {
        return { connected: false, errorMessage: 'Nenhum dispositivo selecionado.' };
      }

      await device.open();

      return {
        connected: true,
        deviceName: device.productName || 'Dispositivo Android',
        vendorId: device.vendorId,
        productId: device.productId,
        serialNumber: device.serialNumber || 'USB-DEVICE-CONNECTED',
        manufacturerName: device.manufacturerName || 'Android Fabricante'
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      if (errorMsg.includes('Permissions policy') || errorMsg.includes('disallowed by permissions policy') || errorMsg.includes('SecurityError')) {
        return {
          connected: false,
          isIframeRestricted: true,
          errorMessage: 'A política de segurança do navegador requer que a conexão USB seja executada em aba própria ou através do script ADB USB (.bat / .sh).'
        };
      }

      if (errorMsg.includes('No device selected') || errorMsg.includes('cancelled') || errorMsg.includes('User cancelled')) {
        return { connected: false, errorMessage: 'Seleção de dispositivo cancelada pelo usuário.' };
      }
      
      return { connected: false, errorMessage: errorMsg };
    }
  }

  /**
   * Generates gradle/wrapper/gradle-wrapper.properties configured with Gradle 8.13
   */
  public static getGradleWrapperProperties(): string {
    return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
  }

  /**
   * Generates gradlew.bat for Windows command line Gradle Wrapper execution
   */
  public static getGradlewBat(): string {
    return `@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows (Gradle 8.13)
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem Resolve JAVA_EXE
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute

echo.
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

if exist "%JAVA_EXE%" goto execute

echo.
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
goto fail

:execute
@rem Setup the command line

set CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar

@rem Execute Gradle
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:fail
exit /b 1
`;
  }

  /**
   * Generates gradlew shell script for Unix / macOS Gradle Wrapper execution
   */
  public static getGradlewSh(): string {
    return `#!/usr/bin/env sh
#
# Copyright 2015 the original author or authors.
#
# Gradle startup script for UN*X (Gradle 8.13)
#

# Attempt to set APP_HOME
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=\`ls -ld "$PRG"\`
    link=\`expr "$ls" : '.*-> \\(.*\\)$'\`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=\`dirname "$PRG"\`"/$link"
    fi
done
SAVED="\`pwd\`"
cd "\`dirname \\"$PRG\\"\`/" >/dev/null
APP_HOME="\`pwd -P\`"
cd "$SAVED" >/dev/null

APP_NAME="Gradle"
APP_BASE_NAME=\`basename "$0"\`

# Determine the Java command to use to start the JVM.
if [ -n "$JAVA_HOME" ] ; then
    if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
        JAVACMD="$JAVA_HOME/jre/sh/java"
    else
        JAVACMD="$JAVA_HOME/bin/java"
    fi
else
    JAVACMD="java"
fi

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

exec "$JAVACMD" "-Dorg.gradle.appname=$APP_BASE_NAME" -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
`;
  }

  /**
   * Generates local.properties configuration template for Android SDK detection
   */
  public static getLocalProperties(): string {
    return `## Android SDK Configuration - Laboratório Dielétrico JVM
## O Android Studio detecta automaticamente o SDK instalado no seu computador.
## Se o Android Studio exibir "SDK location not found" (Local do SDK não localizado),
## o Android Studio irá preencher automaticamente este arquivo ao abrir a pasta descompactada.
##
## Exemplo padrão no Windows:
## sdk.dir=C\\:\\\\Users\\\\SEU_USUARIO\\\\AppData\\\\Local\\\\Android\\\\Sdk
##
## Exemplo padrão no Mac:
## sdk.dir=/Users/SEU_USUARIO/Library/Android/sdk
##
## Exemplo padrão no Linux:
## sdk.dir=/home/SEU_USUARIO/Android/Sdk
`;
  }

  /**
   * Generates gradle.properties with crucial fix for Windows paths with accents/non-ASCII (e.g. João Carlos)
   * and disables Jetifier to avoid configuration mutation errors on Gradle 8/9/10.
   */
  public static getGradleProperties(): string {
    return `# JVM Engenharia Elétrica - Laboratório Dielétrico
# Gradle 8.13 & Android Studio Compatibility Configuration
android.overridePathCheck=true

# Habilita o AndroidX nativo (Jetifier desativado para Gradle 8.13 / AGP 8.7+)
android.useAndroidX=true
android.enableJetifier=false
android.nonTransitiveRClass=true

# Otimizações de compilação Gradle 8.13 e JVM 17
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=false
org.gradle.warning.mode=summary
`;
  }

  /**
   * Generates the Windows Batch ADB auto-installer script
   */
  public static getWindowsADBScript(appUrl: string): string {
    return `@echo off
chcp 65001 > nul
cls
echo ==============================================================================
echo   LABORATÓRIO DIELÉTRICO JVM - INSTALADOR VIA CABO USB (MODO DESENVOLVEDOR)
echo   JVM Engenharia Elétrica ^| Versão 5.2.0 (Nuvem & Offline)
echo ==============================================================================
echo.

echo [1/4] Verificando conexão ADB (Android Debug Bridge)...
adb version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] O comando 'adb' não foi encontrado no PATH do Windows.
    echo Certifique-se de que o Android SDK Platform-Tools está instalado ou 
    echo execute este script na mesma pasta do adb.exe.
    echo.
    echo Baixe o Platform-Tools oficial do Google em:
    echo https://developer.android.com/tools/releases/platform-tools
    echo.
    pause
    exit /b 1
)

echo [OK] ADB instalado e pronto.
echo.
echo [2/4] Detectando dispositivos Android conectados via cabo USB...
adb devices
echo.
echo Se o seu aparelho exibir "device unauthorized", olhe a tela do celular e marque:
echo   [X] "Sempre permitir a partir deste computador" e toque em [OK].
echo.
pause

echo.
echo [3/4] Configurando túnel reverso de rede (Porta 3000)...
adb reverse tcp:3000 tcp:3000
if %ERRORLEVEL% EQU 0 (
    echo [OK] Túnel USB ativo! O celular agora acessa o servidor local via cabo USB.
)

echo.
echo [4/4] Enviando inicialização e instalando atalho nativo no Android...
set APP_URL=${appUrl}
adb shell am start -a android.intent.action.VIEW -d "%APP_URL%" com.android.chrome
if %ERRORLEVEL% NEQ 0 (
    adb shell am start -a android.intent.action.VIEW -d "%APP_URL%"
)

echo.
echo ==============================================================================
echo   INSTALAÇÃO INICIADA COM SUCESSO NO ANDROID!
echo   No celular: Toque nos 3 pontos do Chrome e selecione "Instalar Aplicativo".
echo ==============================================================================
echo.
pause
`;
  }

  /**
   * Generates the Linux / macOS Shell ADB auto-installer script
   */
  public static getUnixADBScript(appUrl: string): string {
    return `#!/usr/bin/env bash
# ==============================================================================
#   LABORATÓRIO DIELÉTRICO JVM - INSTALADOR VIA CABO USB (MODO DESENVOLVEDOR)
#   JVM Engenharia Elétrica | Versão 5.2.0
# ==============================================================================

echo "=============================================================================="
echo "  LABORATÓRIO DIELÉTRICO JVM - INSTALAÇÃO ANDROID VIA CABO USB (ADB)"
echo "=============================================================================="
echo ""

if ! command -v adb &> /dev/null; then
    echo "[ERRO] ADB não encontrado. Instale com: sudo apt install adb (Linux) ou brew install android-platform-tools (macOS)"
    exit 1
fi

echo "[1/4] Verificando aparelhos conectados via USB..."
adb devices

echo ""
echo "Se o aparelho listar como 'unauthorized', autorize a Depuração USB na tela do celular."
read -p "Pressione [ENTER] quando o celular estiver autorizado..."

echo ""
echo "[2/4] Configurando Reverse Proxy USB (porta 3000)..."
adb reverse tcp:3000 tcp:3000

echo ""
echo "[3/4] Abrindo aplicação em tela cheia no Android..."
APP_URL="${appUrl}"
adb shell am start -a android.intent.action.VIEW -d "$APP_URL" com.android.chrome || adb shell am start -a android.intent.action.VIEW -d "$APP_URL"

echo ""
echo "=============================================================================="
echo "  SUCESSO! O app foi iniciado no dispositivo via USB."
echo "  No Chrome do celular, toque em ⋮ -> 'Instalar Aplicativo' para fixar o ícone nativo."
echo "=============================================================================="
`;
  }

  /**
   * Generates MainActivity.java for Standalone Native Android WebView with Camera QR scanner, Local Storage & Native File Saver Bridge
   */
  public static getMainActivityJava(appUrl: string): string {
    return `package br.com.jvmengenharia.dielectriclab;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final String TAG = "JVMDielectricLab";
    private static final String CHANNEL_ID = "jvm_downloads_channel";
    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final int PERMISSION_REQUEST_CODE = 1002;
    private static final String APP_URL = "${appUrl}";

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileUploadCallback;
    private Uri cameraPhotoUri;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Tela cheia e manutenção de tela ativa durante ensaios dielétricos
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        createNotificationChannel();
        checkAndRequestAppPermissions();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // Identificador nativo e compatibilidade total com tablets Samsung e smartphones Xiaomi/Motorola
        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " JVMDielectricLab-Android-APK/5.2.0 (Xiaomi-Samsung-Camera-Enabled)");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);

        // Ponte JavaScript Nativa para Salvar Arquivos Localmente na Memória do Celular / Tablet
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
        webView.addJavascriptInterface(new AndroidBridge(this), "Android");

        // Download Listener para Laudos PDF, Certificados, Backups JSON e CSVs
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                if (url.startsWith("data:")) {
                    saveDataUrlLocally(url, mimetype, URLUtil.guessFileName(url, contentDisposition, mimetype));
                    return;
                }
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                String cookies = CookieManager.getInstance().getCookie(url);
                request.addRequestHeader("cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("Baixando documento técnico JVM...");
                request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype));
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "JVM_Laudos_Dieletricos/" + URLUtil.guessFileName(url, contentDisposition, mimetype));
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(MainActivity.this, "Download iniciado para /Download/JVM_Laudos_Dieletricos/", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.w(TAG, "Download manager fallback", e);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") || url.startsWith("intent:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            // Permissão de Câmera (QR Code Scanner, Vídeo e Fotos) e Microfone
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(new String[]{
                                Manifest.permission.CAMERA,
                                Manifest.permission.ACCESS_FINE_LOCATION
                            }, PERMISSION_REQUEST_CODE);
                        }
                    }
                    request.grant(request.getResources());
                });
            }

            // Permissão de Geolocalização (GPS de Campo para Carimbo de Laudo)
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            // Upload de Arquivos / Abertura Direta da Câmera do Celular para Registro Fotográfico
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                fileUploadCallback = filePathCallback;

                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    try {
                        File photoFile = createPhotoFile();
                        if (photoFile != null) {
                            cameraPhotoUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                photoFile
                            );
                            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        }
                    } catch (Exception ex) {
                        Log.e(TAG, "Erro ao preparar arquivo para câmera", ex);
                        cameraPhotoUri = null;
                    }
                }

                Intent contentSelectionIntent = fileChooserParams.createIntent();
                Intent[] intentArray;
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    intentArray = new Intent[]{takePictureIntent};
                } else {
                    intentArray = new Intent[0];
                }

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Tirar Foto com a Câmera ou Selecionar Arquivo");
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    cameraPhotoUri = null;
                    Toast.makeText(MainActivity.this, "Erro ao abrir câmera do celular", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl(APP_URL);
    }

    private File createPhotoFile() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String imageFileName = "JVM_ENSAIO_" + timeStamp + "_";
            File storageDir = getExternalCacheDir();
            if (storageDir == null) {
                storageDir = getCacheDir();
            }
            return File.createTempFile(imageFileName, ".jpg", storageDir);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao criar arquivo temporário da foto", e);
            return null;
        }
    }

    private void checkAndRequestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissionsNeeded = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.CAMERA);
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                }
                if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                    permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
                }
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
                }
            }

            if (!permissionsNeeded.isEmpty()) {
                requestPermissions(permissionsNeeded.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Downloads de Laudos e Ensaios JVM";
            String description = "Notificações de laudos, certificados e relatórios dielétricos salvos no celular";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void saveDataUrlLocally(String dataUrl, String mimeType, String fileName) {
        try {
            int commaIndex = dataUrl.indexOf(",");
            if (commaIndex > 0) {
                String base64Data = dataUrl.substring(commaIndex + 1);
                new AndroidBridge(this).saveBase64File(base64Data, mimeType, fileName, true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao salvar DataUrl", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK) {
                    if (data != null && data.getData() != null) {
                        // Seleção vinda da galeria / arquivos
                        results = new Uri[]{data.getData()};
                    } else if (data != null && data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (cameraPhotoUri != null) {
                        // Foto tirada diretamente pela câmera do celular
                        results = new Uri[]{cameraPhotoUri};
                    } else {
                        results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
            cameraPhotoUri = null;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * Ponte Nativa Android de Salvamento Local, Compartilhamento e Notificações
     */
    public class AndroidBridge {
        private final Context context;

        public AndroidBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getStorageDirectory() {
            return "/Download/JVM_Laudos_Dieletricos/";
        }

        @JavascriptInterface
        public void requestCameraPermissions() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISSION_REQUEST_CODE);
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean saveBase64File(String base64Data, String mimeType, String fileName, boolean openAfterSave) {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                Uri savedFileUri = null;
                File savedFile = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/JVM_Laudos_Dieletricos");

                    ContentResolver resolver = context.getContentResolver();
                    savedFileUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                    if (savedFileUri != null) {
                        try (OutputStream os = resolver.openOutputStream(savedFileUri)) {
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                            }
                        }
                    }
                } else {
                    File downloadsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "JVM_Laudos_Dieletricos");
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    savedFile = new File(downloadsDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(savedFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                    savedFileUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", savedFile);
                    MediaScannerConnection.scanFile(context, new String[]{savedFile.getAbsolutePath()}, new String[]{mimeType}, null);
                }

                // Exibe Toast de Confirmação
                runOnUiThread(() -> Toast.makeText(context, "✅ Arquivo salvo: " + fileName + "\\nLocal: Downloads/JVM_Laudos_Dieletricos/", Toast.LENGTH_LONG).show());

                // Emite Notificação com Ação de Abrir
                showFileSavedNotification(fileName, mimeType, savedFileUri);

                // Abre o arquivo automaticamente se solicitado
                if (openAfterSave && savedFileUri != null) {
                    Intent openIntent = new Intent(Intent.ACTION_VIEW);
                    openIntent.setDataAndType(savedFileUri, mimeType);
                    openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(Intent.createChooser(openIntent, "Abrir " + fileName));
                }

                return true;
            } catch (Exception e) {
                Log.e(TAG, "Erro ao salvar arquivo localmente", e);
                runOnUiThread(() -> Toast.makeText(context, "Erro ao salvar arquivo na memória: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public boolean saveTextFile(String content, String mimeType, String fileName) {
            try {
                String base64 = Base64.encodeToString(content.getBytes("UTF-8"), Base64.NO_WRAP);
                return saveBase64File(base64, mimeType, fileName, false);
            } catch (Exception e) {
                Log.e(TAG, "Erro ao salvar arquivo de texto", e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareBase64File(String base64Data, String mimeType, String fileName, String title) {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                File cacheDir = new File(context.getCacheDir(), "shared_docs");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                File tempFile = new File(cacheDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", tempFile);

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(mimeType);
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                shareIntent.putExtra(Intent.EXTRA_TEXT, "Documento técnico emitido pelo Laboratório Dielétrico JVM: " + title);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                context.startActivity(Intent.createChooser(shareIntent, "Compartilhar " + fileName));
                return true;
            } catch (Exception e) {
                Log.e(TAG, "Erro ao compartilhar arquivo", e);
                return false;
            }
        }

        @JavascriptInterface
        public void openLocalDownloads() {
            try {
                Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(context, "Abra o aplicativo 'Arquivos' ou 'Downloads' no seu aparelho.", Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(ms);
                }
            } catch (Exception ignored) {}
        }

        private void showFileSavedNotification(String fileName, String mimeType, Uri fileUri) {
            try {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(fileUri, mimeType);
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                PendingIntent pi = PendingIntent.getActivity(
                    context, 
                    (int) System.currentTimeMillis(), 
                    Intent.createChooser(viewIntent, "Abrir " + fileName), 
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("📄 Documento Salvo no Celular")
                    .setContentText(fileName)
                    .setSubText("Downloads/JVM_Laudos_Dieletricos")
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setContentIntent(pi);

                nm.notify((int) (System.currentTimeMillis() % 10000), builder.build());
            } catch (Exception e) {
                Log.w(TAG, "Erro ao emitir notificação", e);
            }
        }
    }
}
`;
  }

  /**
   * Generates activity_main.xml layout
   */
  public static getActivityMainXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#0A2540">

    <ProgressBar
        android:id="@+id/progressBar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="4dp"
        android:layout_alignParentTop="true"
        android:indeterminate="false"
        android:max="100"
        android:progressDrawable="@android:drawable/progress_horizontal"
        android:visibility="gone" />

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_below="@id/progressBar" />

</RelativeLayout>
`;
  }

  /**
   * Generates AndroidManifest.xml for Android Studio / Gradle build with FileProvider, Local Storage & Notification support
   */
  public static getAndroidManifestXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="br.com.jvmengenharia.dielectriclab">

    <!-- Permissões de Rede, Sincronização em Tempo Real (Supabase) e Câmera do Celular -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    
    <!-- Permissões da Câmera para Registro Fotográfico de Inspeção, Evidências e Leitura QR Code -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.camera.flash" android:required="false" />
    
    <!-- Permissões de GPS / Localização para Carimbo em Laudos Dielétricos -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
    
    <!-- Permissões de Armazenamento Local e Notificações (Android 7 até Android 15+) -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    
    <!-- Permissões de Bluetooth para Impressão Térmica de Etiquetas Dielétricas (Niimbot B1/B21/D110) -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />

    <!-- Suporte Total a Telas de Celulares (Xiaomi/Redmi/POCO/Motorola) e Tablets (Samsung Galaxy Tab) -->
    <supports-screens
        android:smallScreens="true"
        android:normalScreens="true"
        android:largeScreens="true"
        android:xlargeScreens="true"
        android:anyDensity="true"
        android:resizeable="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="JVM Ensaios"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
        android:usesCleartextTraffic="true">

        <!-- FileProvider para Compartilhamento Seguro de Laudos, Certificados, Relatórios e Fotos da Câmera -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="br.com.jvmengenharia.dielectriclab.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:launchMode="singleTask"
            android:screenOrientation="unspecified"
            android:resizeableActivity="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" />
                <data android:scheme="http" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
  }

  /**
   * Generates file_paths.xml for FileProvider to securely open and share PDFs/CSVs/JSONs
   */
  public static getFilePathsXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="external_download" path="Download" />
    <external-path name="external_files" path="." />
    <external-files-path name="my_docs" path="." />
    <external-cache-path name="external_cache" path="." />
    <cache-path name="cache" path="." />
    <files-path name="files" path="." />
</paths>
`;
  }

  /**
   * Generates app/build.gradle with modern Gradle plugin DSL and robust APK build options
   */
  public static getAppBuildGradle(): string {
    return `plugins {
    id 'com.android.application'
}

android {
    namespace 'br.com.jvmengenharia.dielectriclab'
    compileSdk 35

    defaultConfig {
        applicationId "br.com.jvmengenharia.dielectriclab"
        minSdk 24
        targetSdk 35
        versionCode 520
        versionName "5.2.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
        debug {
            applicationIdSuffix ".debug"
            debuggable true
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    lint {
        abortOnError false
        checkReleaseBuilds false
    }
}

// Desativa variantes de teste desnecessárias para acelerar e garantir compilação direta do APK no Gradle 8.13
androidComponents {
    beforeVariants(selector().all()) { variantBuilder ->
        variantBuilder.enableAndroidTest = false
        variantBuilder.enableUnitTest = false
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'com.google.android.material:material:1.12.0'
}
`;
  }

  /**
   * Generates root build.gradle with modern plugins block compatible with Gradle 8.13 & Android Studio
   */
  public static getRootBuildGradle(): string {
    return `plugins {
    id 'com.android.application' version '8.7.3' apply false
}

tasks.register('clean', Delete) {
    delete rootProject.layout.buildDirectory
}
`;
  }

  /**
   * Generates settings.gradle with modern repository management for Gradle 8.13
   */
  public static getSettingsGradle(): string {
    return `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "JVM-Dielectric-Lab"
include ':app'
`;
  }

  /**
   * Generates strings.xml
   */
  public static getStringsXml(): string {
    return `<resources>
    <string name="app_name">JVM Ensaios Dielétricos</string>
    <string name="company_name">JVM Engenharia Elétrica</string>
</resources>
`;
  }

  /**
   * Generates colors.xml
   */
  public static getColorsXml(): string {
    return `<resources>
    <color name="primary">#0A2540</color>
    <color name="primary_dark">#061626</color>
    <color name="accent">#F97316</color>
    <color name="background">#020617</color>
</resources>
`;
  }

  /**
   * Generates launcher icon background XML
   */
  public static getLauncherBackgroundXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#0A2540"
        android:pathData="M0,0h108v108h-108z"/>
</vector>
`;
  }

  /**
   * Generates launcher icon foreground XML (NR-10 Electrical Safety Shield & Bolt)
   */
  public static getLauncherForegroundXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Escudo de Proteção Dielétrica / EPI NR-10 -->
    <path
        android:fillColor="#F97316"
        android:pathData="M54,20 L78,30 L78,54 C78,69 68,82 54,88 C40,82 30,69 30,54 L30,30 Z" />
    <!-- Raio Elétrico Alta Tensão -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M56,36 L43,53 L52,53 L49,72 L65,49 L55,49 Z" />
</vector>
`;
  }

  /**
   * Generates adaptive-icon XML for mipmap-anydpi-v26
   */
  public static getAdaptiveIconXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
  }

  /**
   * Generates standalone vector icon for ic_launcher
   */
  public static getIconDrawableXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp"
    android:height="48dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path
        android:fillColor="#0A2540"
        android:pathData="M0,0h48v48h-48z"/>
    <path
        android:fillColor="#F97316"
        android:pathData="M24,8 L36,13 L36,24 C36,31 31,37 24,40 C17,37 12,31 12,24 L12,13 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M25,15 L19,23 L23,23 L22,31 L29,22 L25,22 Z" />
</vector>
`;
  }

  /**
   * Generates build-apk-windows.bat with auto-repair for non-ASCII user paths and Gradle 8.13
   */
  public static getBuildApkWindowsBat(): string {
    return `@echo off
chcp 65001 > nul
cls
echo ==============================================================================
echo   COMPILADOR DE APK ANDROID (GRADLE 8.13) - LABORATÓRIO DIELÉTRICO JVM
echo   JVM Engenharia Elétrica ^| Versão 5.2.0
echo ==============================================================================
echo.

:: 1. Auto-configura gradle.properties com overridePathCheck=true e enableJetifier=false
if not exist gradle.properties (
    echo [INFO] Criando gradle.properties com suporte ao Gradle 8.13 e caminhos especiais...
    (
        echo android.overridePathCheck=true
        echo android.useAndroidX=true
        echo android.enableJetifier=false
        echo android.nonTransitiveRClass=true
        echo org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
        echo org.gradle.parallel=true
        echo org.gradle.caching=true
        echo org.gradle.configuration-cache=false
        echo org.gradle.warning.mode=summary
    ) > gradle.properties
) else (
    findstr /m "android.overridePathCheck" gradle.properties > nul 2>&1
    if errorlevel 1 (
        echo. >> gradle.properties
        echo android.overridePathCheck=true >> gradle.properties
        echo [INFO] Adicionado android.overridePathCheck=true em gradle.properties.
    )
    findstr /m "android.enableJetifier=false" gradle.properties > nul 2>&1
    if errorlevel 1 (
        echo. >> gradle.properties
        echo android.enableJetifier=false >> gradle.properties
    )
)

echo [1/3] Compilando APK com Gradle 8.13...
if exist gradlew.bat (
    call gradlew.bat :app:assembleDebug --no-daemon
) else (
    echo [INFO] Executando compilação do APK Debug com Gradle...
    gradle :app:assembleDebug --no-daemon
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================================================
    echo   [SUCESSO] APK COMPILADO COM SUCESSO COM GRADLE 8.13!
    echo   Local do arquivo gerado:
    echo   app\\build\\outputs\\apk\\debug\\app-debug.apk
    echo ==============================================================================
    echo.
    echo Para instalar no celular conectado via USB:
    echo adb install -r -d app\\build\\outputs\\apk\\debug\\app-debug.apk
) else (
    echo.
    echo ==============================================================================
    echo [ATENÇÃO] Se o erro persistir:
    echo 1. Certifique-se de que o JDK 17 ou 21 está instalado e configurado no PATH.
    echo 2. Abra a pasta diretamente no Android Studio e clique em "Build APK(s)".
    echo 3. Mova a pasta para um caminho sem acentos (Exemplo: C:\\Projetos\\APK).
    echo ==============================================================================
)
echo.
pause
`;
  }

  /**
   * Generates build-apk-unix.sh
   */
  public static getBuildApkUnixSh(): string {
    return `#!/usr/bin/env bash
echo "=============================================================================="
echo "  COMPILADOR DE APK ANDROID (GRADLE 8.13) - LABORATÓRIO DIELÉTRICO JVM"
echo "=============================================================================="
echo ""

# Garante gradle.properties
if [ ! -f "gradle.properties" ]; then
    echo "android.overridePathCheck=true" > gradle.properties
    echo "android.useAndroidX=true" >> gradle.properties
    echo "android.enableJetifier=false" >> gradle.properties
    echo "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8" >> gradle.properties
    echo "org.gradle.warning.mode=summary" >> gradle.properties
fi

if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    ./gradlew :app:assembleDebug --no-daemon
else
    gradle :app:assembleDebug --no-daemon
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "=============================================================================="
    echo "  [SUCESSO] APK COMPILADO COM SUCESSO COM GRADLE 8.13!"
    echo "  Arquivo gerado em: app/build/outputs/apk/debug/app-debug.apk"
    echo "=============================================================================="
    echo ""
    echo "Para instalar no aparelho via USB:"
    echo "adb install -r -d app/build/outputs/apk/debug/app-debug.apk"
else
    echo "[ERRO] Falha na compilação. Verifique se o JDK 17/21 e o Android SDK estão instalados."
fi
`;
  }

  /**
   * Generates capacitor.config.json for fast 1-command APK compilation
   */
  public static getCapacitorConfig(): string {
    return JSON.stringify({
      appId: "br.com.jvmengenharia.dielectriclab",
      appName: "JVM Ensaios Dielétricos",
      webDir: "dist",
      bundledWebRuntime: false,
      server: {
        androidScheme: "https",
        cleartext: true
      },
      plugins: {
        SplashScreen: {
          launchShowDuration: 1500,
          backgroundColor: "#0A2540",
          androidScaleType: "CENTER_CROP"
        }
      }
    }, null, 2);
  }

  /**
   * Generates comprehensive README manual for APK generation & USB installation
   */
  public static getInstallationManual(appUrl: string): string {
    return `# GUIA DE COMPILAÇÃO E INSTALAÇÃO DO APK ANDROID (XIAOMI & SAMSUNG TABLET)
JVM Engenharia Elétrica - Laboratório Dielétrico de Ensaios em EPI/EPC NR-10
Versão: 5.2.0 (Android 15 / Gradle 8.13 + Layout Responsivo Celular/Tablet)

==============================================================================
⚠️ IMPORTANTE: COMO ABRIR NO ANDROID STUDIO SEM O ERRO "NÃO LOCALIZADO"
==============================================================================

1. NÃO ABRA O ARQUIVO .ZIP DIRETAMENTE NO ANDROID STUDIO:
   O Android Studio NÃO consegue abrir arquivos compactados (.zip) diretamente.
   Você DEVE descompactar/extrair o arquivo primeiro:
   - No Windows: Clique com o botão direito no arquivo .zip -> "Extrair Tudo..." -> Extrair.
   - Uma pasta normal com os arquivos do projeto será criada.

2. ABRINDO A PASTA NO ANDROID STUDIO:
   - Abra o Android Studio.
   - Na tela inicial (ou no menu superior), clique em: "File" -> "Open..." (ou "Open Project").
   - Navegue até a PASTA DESCOMPACTADA (a pasta que contém os arquivos "build.gradle" e "settings.gradle").
   - Selecione essa pasta e clique em "OK".
   - O Android Studio detectará o projeto automaticamente e iniciará a sincronização do Gradle 8.13.

3. SE APARECER O ERRO "SDK location not found" (Local do SDK não localizado):
   - No Android Studio, vá em: "Tools" -> "SDK Manager" (ou "Settings" -> "Appearance & Behavior" -> "System Settings" -> "Android SDK").
   - Verifique onde o Android SDK está instalado no seu computador.
   - O Android Studio criará automaticamente o arquivo local.properties apontando para o seu SDK.

4. COMO GERAR O ARQUIVO APK (.apk):
   - Aguarde o Gradle finalizar a indexação.
   - No menu superior, clique em: "Build" -> "Build Bundle(s) / APK(s)" -> "Build APK(s)".
   - Quando a compilação terminar (em cerca de 30 segundos), uma notificação aparecerá no canto inferior direito com o botão "locate".
   - Clique em "locate" e o arquivo "app-debug.apk" estará pronto!

==============================================================================
🛡️ POR QUE O CELULAR DIZ "DESENVOLVEDOR DESCONHECIDO" OU "PLAY PROTECT"?
==============================================================================
Ao instalar qualquer aplicativo APK compilado fora da Google Play Store, o Android
(Google Play Protect) exibe uma mensagem de segurança dizendo:
"App bloqueado pelo Play Protect: Desenvolvedor não reconhecido" ou "Fonte desconhecida".

ISSO É 100% NORMAL E ESPERADO para aplicativos empresariais / APKs privados.

COMO INSTALAR NO APARELHO:
1. Quando a mensagem do Play Protect aparecer na tela do celular:
2. Toque em "Mais detalhes" (ou "Detalhes" / "Ver mais").
3. Toque em "Instalar assim mesmo" (ou "Instalar mesmo assim").
4. O app será instalado e funcionará normalmente.

==============================================================================
✍️ COMO ASSINAR O APK COM SEU PRÓPRIO NOME / EMPRESA (RELEASE ASSINADA)
==============================================================================
Se você quiser que o APK tenha sua assinatura oficial de criador (JVM Engenharia / Seu Nome):
1. No Android Studio, vá no menu superior: "Build" -> "Generate Signed Bundle / APK...".
2. Selecione a opção "APK" e clique em "Next".
3. Em "Key store path", clique em "Create new...":
   - Escolha onde salvar o arquivo de chave (exemplo: C:\\Projetos\\chave-jvm.jks).
   - Defina uma senha para a chave (ex: jvm123456).
   - Em "Certificate", preencha com seus dados:
     * First and Last Name: João Carlos / JVM Engenharia
     * Organizational Unit: Laboratório Dielétrico
     * Organization: JVM Engenharia & Treinamentos
     * City: Sua Cidade | State: Seu Estado | Country: BR (ou 55)
   - Clique em "OK".
4. Selecione o tipo de build "release", marque as caixas de assinatura "V1 (Jar Signature)" e "V2 (Full APK Signature)".
5. Clique em "Finish".
6. O Android Studio criará o arquivo "app-release.apk" assinado oficialmente com os seus dados de criador!

==============================================================================
1. SUPORTE TOTAL A SMARTPHONES XIAOMI E TABLETS SAMSUNG
==============================================================================
Este pacote gera o aplicativo Android (.apk) nativo com WebView ultra otimizada
e paridade funcional de 100% com a plataforma Web:

A. SMARTPHONES XIAOMI / REDMI / POCO (MIUI / HyperOS):
- Orientação vertical e horizontal dinâmica com foco na agilidade em campo.
- Leitor de QR Code via câmera nativa com foco automático para tags de EPI/EPC.
- Upload fotográfico direto da câmera para laudos de inspeção visual.
- Funcionamento offline com fila de envio automática ao banco de dados Supabase.
- Otimização para bateria: sem travamentos em segundo plano.

B. TABLETS SAMSUNG (GALAXY TAB S / GALAXY TAB A / ONE UI):
- Layout responsivo adaptado para telas grandes (8", 10.5", 12.4", 14.6").
- Suporte a modo Paisagem (Horizontal) com bento-grid e tabelas técnicas detalhadas.
- Suporte a Caneta S-Pen para assinatura digital do Responsável Técnico.
- Suporte a Modo DeX e multijanela (Split-Screen) para conferência lado a lado.
- Impressão térmica Bluetooth de etiquetas dielétricas (Niimbot B1/B21/D110).

==============================================================================
2. ALTERNATIVAS DE COMPILAÇÃO E INSTALAÇÃO
==============================================================================

OPÇÃO 1: COMPILAÇÃO EM 1-CLIQUE NO WINDOWS (Sem abrir o Android Studio)
1. Extraia o arquivo ZIP na sua máquina (exemplo: C:\\Projetos\\JVM-APK).
2. Dê um duplo clique no arquivo: "build-apk-windows.bat".
3. O script executa o Gradle 8.13 e compila o APK diretamente em:
   app\\build\\outputs\\apk\\debug\\app-debug.apk

OPÇÃO 2: INSTALAÇÃO DIRETA VIA CABO USB (ADB)
1. Conecte o celular Xiaomi ou tablet Samsung no PC via cabo USB com Depuração USB ativa.
2. Dê duplo clique em "install-via-usb.bat".

OPÇÃO 3: INSTALAÇÃO INSTANTÂNEA NO CELULAR/TABLET (SEM COMPUTADOR)
1. No seu celular ou tablet Android, abra o Google Chrome e acesse:
   ${appUrl}
2. Toque nos 3 pontinhos (canto superior direito do Chrome) e selecione:
   "Instalar Aplicativo" ou "Adicionar à tela inicial".
3. Pronto! O app fica instalado como aplicativo nativo em tela cheia com ícone,
   suporte a câmera, fotos e funcionamento offline.

==============================================================================
3. DICAS ESPECÍFICAS PARA CONFIGURAR SEU APARELHO
==============================================================================

DICAS PARA XIAOMI / REDMI / POCO:
1. Ao instalar o APK pela primeira vez, se a MIUI/HyperOS perguntar "Instalar aplicativo de fonte desconhecida", clique em "Permitir desta fonte".
2. No menu do app, conceda a permissão de Câmera quando solicitado para usar o leitor de QR Code integrado.

DICAS PARA TABLET SAMSUNG:
1. Abra o app com o tablet na horizontal para usufruir da visualização de laboratório completa com gráficos de corrente de fuga mA e tabelas comparativas.
2. Ao emitir um laudo, clique em "Assinar na Tela" para assinar com o dedo ou com a caneta S-Pen.
`;
  }

  /**
   * Trigger direct download of any text or script file
   */
  public static downloadFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Generates and downloads the complete Android Studio APK source project as a .zip file
   */
  public static async generateAndDownloadAndroidStudioZip(appUrl: string): Promise<void> {
    const zip = new JSZip();

    // 1. Root configuration files (including gradle.properties with path check override and Gradle 8.13)
    zip.file('local.properties', this.getLocalProperties());
    zip.file('gradle.properties', this.getGradleProperties());
    zip.file('build.gradle', this.getRootBuildGradle());
    zip.file('settings.gradle', this.getSettingsGradle());
    zip.file('gradlew.bat', this.getGradlewBat());
    zip.file('gradlew', this.getGradlewSh(), { unixPermissions: '755' });
    zip.file('capacitor.config.json', this.getCapacitorConfig());
    zip.file('install-via-usb.bat', this.getWindowsADBScript(appUrl));
    zip.file('install-via-usb.sh', this.getUnixADBScript(appUrl), { unixPermissions: '755' });
    zip.file('build-apk-windows.bat', this.getBuildApkWindowsBat());
    zip.file('build-apk-unix.sh', this.getBuildApkUnixSh(), { unixPermissions: '755' });
    zip.file('MANUAL-GERACAO-APK-E-INSTALACAO.txt', this.getInstallationManual(appUrl));

    // 2. Gradle Wrapper (Gradle 8.13)
    const gradleFolder = zip.folder('gradle');
    const wrapperFolder = gradleFolder?.folder('wrapper');
    if (wrapperFolder) {
      wrapperFolder.file('gradle-wrapper.properties', this.getGradleWrapperProperties());
    }

    // 3. App Module
    const appFolder = zip.folder('app');
    if (appFolder) {
      appFolder.file('build.gradle', this.getAppBuildGradle());
      
      const srcFolder = appFolder.folder('src');
      const mainFolder = srcFolder?.folder('main');
      if (mainFolder) {
        mainFolder.file('AndroidManifest.xml', this.getAndroidManifestXml());

        // Java source
        const javaFolder = mainFolder.folder('java');
        const pkgFolder = javaFolder?.folder('br')?.folder('com')?.folder('jvmengenharia')?.folder('dielectriclab');
        if (pkgFolder) {
          pkgFolder.file('MainActivity.java', this.getMainActivityJava(appUrl));
        }

        // Resources
        const resFolder = mainFolder.folder('res');
        const layoutFolder = resFolder?.folder('layout');
        if (layoutFolder) {
          layoutFolder.file('activity_main.xml', this.getActivityMainXml());
        }

        const valuesFolder = resFolder?.folder('values');
        if (valuesFolder) {
          valuesFolder.file('strings.xml', this.getStringsXml());
          valuesFolder.file('colors.xml', this.getColorsXml());
        }

        // FileProvider paths for local storage sharing & notifications
        const xmlFolder = resFolder?.folder('xml');
        if (xmlFolder) {
          xmlFolder.file('file_paths.xml', this.getFilePathsXml());
        }

        // Drawables & Icons (Eliminates AAPT resource mipmap/ic_launcher not found error)
        const drawableFolder = resFolder?.folder('drawable');
        if (drawableFolder) {
          drawableFolder.file('ic_launcher_background.xml', this.getLauncherBackgroundXml());
          drawableFolder.file('ic_launcher_foreground.xml', this.getLauncherForegroundXml());
          drawableFolder.file('ic_launcher.xml', this.getIconDrawableXml());
        }

        const mipmapAnyDpiFolder = resFolder?.folder('mipmap-anydpi-v26');
        if (mipmapAnyDpiFolder) {
          mipmapAnyDpiFolder.file('ic_launcher.xml', this.getAdaptiveIconXml());
          mipmapAnyDpiFolder.file('ic_launcher_round.xml', this.getAdaptiveIconXml());
        }

        const mipmapHdpiFolder = resFolder?.folder('mipmap-hdpi');
        if (mipmapHdpiFolder) {
          mipmapHdpiFolder.file('ic_launcher.xml', this.getIconDrawableXml());
          mipmapHdpiFolder.file('ic_launcher_round.xml', this.getIconDrawableXml());
        }

        const mipmapXhdpiFolder = resFolder?.folder('mipmap-xhdpi');
        if (mipmapXhdpiFolder) {
          mipmapXhdpiFolder.file('ic_launcher.xml', this.getIconDrawableXml());
          mipmapXhdpiFolder.file('ic_launcher_round.xml', this.getIconDrawableXml());
        }
      }
    }

    // Generate zip blob and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jvm-dielectric-lab-android-apk-v5.2.0.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }

  /**
   * Downloads all USB installation files in sequence
   */
  public static downloadCompleteUSBPak(appUrl: string): void {
    this.generateAndDownloadAndroidStudioZip(appUrl);
  }
}
