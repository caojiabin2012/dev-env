import { useState, useEffect } from 'react';
import { getAppVersion, installUpdateAndRestart } from '@/lib/settings-api';
import { checkForUpdate, type UpdateInfo } from '@/lib/updater';

export function About() {
  const [version, setVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(console.error);
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const result = await checkForUpdate({ timeout: 30000 });
      if (result.status === 'available') {
        setUpdateInfo(result.info);
      } else {
        setUpdateInfo(null);
      }
      setChecked(true);
    } catch (error) {
      console.error('Failed to check update:', error);
      setUpdateError(String(error));
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setDownloadProgress('正在下载更新...');
    setUpdateError(null);
    try {
      const installed = await installUpdateAndRestart();
      if (!installed) {
        setDownloadProgress('已是最新版本');
      } else {
        setDownloadProgress('正在安装，应用即将退出...');
      }
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateError(String(error));
      setDownloadProgress('');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">🧰</div>
        <h1 className="text-2xl font-bold text-foreground">Dev Tools</h1>
        <p className="text-muted-foreground">开发者工具箱</p>
        <p className="text-sm text-muted-foreground">
          版本 {version || '...'}
        </p>

        <div className="pt-4">
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {checking ? '检查中...' : '检查更新'}
          </button>
        </div>

        {checked && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-left">
            {updateInfo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span className="text-sm font-medium text-foreground">
                    发现新版本 v{updateInfo.availableVersion}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  当前版本: v{updateInfo.currentVersion} → 新版本: v{updateInfo.availableVersion}
                </p>
                {updateInfo.notes && (
                  <div className="text-xs text-muted-foreground max-h-32 overflow-auto">
                    <p className="font-medium mb-1">更新内容:</p>
                    <pre className="whitespace-pre-wrap">{updateInfo.notes}</pre>
                  </div>
                )}
                {downloadProgress && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <span>●</span>
                    <span>{downloadProgress}</span>
                  </div>
                )}
                {updateError && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    <span>●</span>
                    <span>{updateError}</span>
                  </div>
                )}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {downloading ? '下载安装中...' : '立即更新'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-green-500">●</span>
                <span className="text-sm text-foreground">已是最新版本</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-6 text-xs text-muted-foreground space-y-1">
          <p>快捷键: Ctrl+Shift+V 显示/隐藏窗口</p>
          <p>剪切板监控支持文本、图片、文件</p>
          <p>图片支持 OCR 文字识别</p>
        </div>
      </div>
    </div>
  );
}
