import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSettings, saveSettings, getAppVersion, updateShortcuts, installUpdateAndRestart } from '@/lib/settings-api';
import type { AppSettings } from '@/lib/settings-api';
import type { UpdateInfo } from '@/lib/updater';
import type { Theme } from '@/lib/use-theme';
import { formatShortcutDisplay, isValidShortcut, keyboardEventToShortcut } from '@/lib/shortcuts';

export type SettingsTab = 'general' | 'advanced' | 'about';

const THEME_OPTIONS: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: '明亮', icon: '☀️' },
  { id: 'dark', label: '暗黑', icon: '🌙' },
  { id: 'system', label: '跟随系统', icon: '💻' },
];

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'advanced', label: '高级' },
  { id: 'about', label: '关于' },
];

const SHORTCUT_TOOLS: { id: string; name: string; icon: string; defaultShortcut: string }[] = [
  { id: 'clipboard', name: '剪切板', icon: '📋', defaultShortcut: 'Ctrl+Shift+V' },
  { id: 'json-formatter', name: 'JSON', icon: '📝', defaultShortcut: '' },
  { id: 'calculator', name: '计算器', icon: '🧮', defaultShortcut: '' },
];

const ABOUT_FEATURE_GROUPS = [
  {
    name: '常用工具',
    items: [
      { icon: '📋', label: '剪切板', desc: '历史记录 · 图片 OCR · 快速复制' },
      { icon: '📝', label: 'JSON', desc: '美化排版 · 一键压缩 · 树形高亮' },
      { icon: '🧮', label: '计算器', desc: '科学计算 · 单位 / 汇率 / 个税等' },
      { icon: '📅', label: '日历', desc: '农历黄历 · 备忘 · 提醒' },
    ],
  },
  {
    name: '编码与生成',
    items: [
      { icon: '🔄', label: '编码工具', desc: 'Base64 · URL · 时间戳' },
      { icon: '⚡', label: '生成工具', desc: 'UUID · 随机密码' },
    ],
  },
  {
    name: '查询与开发',
    items: [
      { icon: '🪪', label: '身份证', desc: '解析 · 校验 · 批量生成' },
      { icon: '🛠️', label: '开发工具', desc: '正则测试 · Cron 解析' },
    ],
  },
] as const;

interface SettingsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  updateInfo: UpdateInfo | null;
  updateError: string | null;
  checkingUpdate: boolean;
  updateChecked: boolean;
  onCheckUpdate: () => Promise<UpdateInfo | null | undefined>;
}

export function Settings({
  activeTab,
  onTabChange,
  theme,
  onThemeChange,
  updateInfo,
  updateError,
  checkingUpdate,
  updateChecked,
  onCheckUpdate,
}: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({ auto_start: false, close_to_tray: true, shortcuts: {} });
  const [version, setVersion] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
    getAppVersion().then(setVersion).catch(console.error);
  }, []);

  const handleToggle = async (key: 'auto_start' | 'close_to_tray', value: boolean) => {
    const prev = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaveError(null);
    try {
      const updated = await saveSettings(next.auto_start, next.close_to_tray, next.shortcuts);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettings(prev);
      setSaveError(String(error));
    }
  };

  const handleShortcutChange = useCallback(async (toolId: string, shortcut: string) => {
    setShortcutError(null);
    const prev = settings;
    const newShortcuts = { ...settings.shortcuts };

    if (shortcut) {
      // Check for conflicts
      const conflict = Object.entries(newShortcuts).find(
        ([id, s]) => id !== toolId && s === shortcut
      );
      if (conflict) {
        setShortcutError(`快捷键 ${shortcut} 已被 ${SHORTCUT_TOOLS.find(t => t.id === conflict[0])?.name || conflict[0]} 使用`);
        return;
      }

      // Validate format
      if (!isValidShortcut(shortcut)) {
        setShortcutError('快捷键格式不正确，例如：Ctrl+Shift+V 或 Ctrl+~');
        return;
      }

      newShortcuts[toolId] = shortcut;
    } else {
      delete newShortcuts[toolId];
    }

    const next = { ...settings, shortcuts: newShortcuts };
    setSettings(next);
    try {
      await updateShortcuts(newShortcuts);
    } catch (error) {
      console.error('Failed to update shortcuts:', error);
      setSettings(prev);
      setShortcutError(String(error));
    }
  }, [settings]);

  const handleShortcutKeyDown = useCallback((e: React.KeyboardEvent, toolId: string) => {
    if (e.key === 'Escape') {
      setEditingShortcut(null);
      return;
    }

    if (editingShortcut !== toolId) return;

    e.preventDefault();
    e.stopPropagation();

    const shortcut = keyboardEventToShortcut(e.nativeEvent);
    if (shortcut) {
      handleShortcutChange(toolId, shortcut);
      setEditingShortcut(null);
    }
  }, [editingShortcut, handleShortcutChange]);

  const handleDownloadUpdate = async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setDownloadProgress('正在下载更新...');
    try {
      const installed = await installUpdateAndRestart();
      if (!installed) {
        setDownloadProgress('已是最新版本');
      } else {
        setDownloadProgress('正在安装，应用即将退出...');
      }
    } catch (error) {
      console.error('Failed to install update:', error);
      setDownloadProgress('更新失败: ' + String(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-0 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-foreground">设置</h2>
        <nav className="flex gap-1 mt-4 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
              {tab.id === 'about' && updateInfo && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 align-middle" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <SectionTitle title="窗口与启动" />
              {saveError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {saveError}
                </div>
              )}
              <SettingItem
                title="开机自启动"
                description="系统启动时自动运行 Dev Tools"
                checked={settings.auto_start}
                onChange={(v) => handleToggle('auto_start', v)}
              />
              <SettingItem
                title="关闭时最小化到托盘"
                description="点击关闭按钮时隐藏到系统托盘；右键托盘图标可退出"
                checked={settings.close_to_tray}
                onChange={(v) => handleToggle('close_to_tray', v)}
              />

              <SectionTitle title="快捷键" className="mt-8" />
              <p className="text-xs text-muted-foreground -mt-2">
                点击输入框后按下键盘快捷键，按 Esc 取消；1 键左侧的 ~ 键可设为 Ctrl+~
              </p>
              {shortcutError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {shortcutError}
                </div>
              )}
              <div className="space-y-2">
                {SHORTCUT_TOOLS.map((tool) => {
                  const currentShortcut = settings.shortcuts[tool.id] || '';
                  const isEditing = editingShortcut === tool.id;

                  return (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{tool.icon}</span>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{tool.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {currentShortcut ? '已设置快捷键' : '未设置快捷键'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingShortcut(isEditing ? null : tool.id)}
                          className={`px-3 py-1.5 text-sm font-mono rounded-lg border transition-colors min-w-[120px] text-center ${
                            isEditing
                              ? 'border-primary bg-primary/10 text-primary animate-pulse'
                              : currentShortcut
                              ? 'border-border bg-secondary text-foreground hover:bg-secondary/80'
                              : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50'
                          }`}
                        >
                          {isEditing
                            ? '按下快捷键...'
                            : currentShortcut
                              ? formatShortcutDisplay(currentShortcut)
                              : '点击设置'}
                        </button>
                        {currentShortcut && !isEditing && (
                          <button
                            onClick={() => handleShortcutChange(tool.id, '')}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="清除快捷键"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <SectionTitle title="外观" className="mt-8" />
              <ThemeSelector theme={theme} onChange={onThemeChange} />
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <SectionTitle title="数据存储" />
              <InfoCard title="本地数据目录">
                <code className="text-xs text-muted-foreground break-all">
                  %LOCALAPPDATA%\dev-tools
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  剪切板历史、应用设置等数据保存在此目录
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  崩溃诊断：<code className="text-[11px]">crash.log</code> · 运行日志：<code className="text-[11px]">logs/</code>
                </p>
              </InfoCard>

              <SectionTitle title="剪切板" className="mt-8" />
              <InfoCard title="监控说明">
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>自动记录文本与图片复制历史</li>
                  <li>支持搜索、筛选、置顶与一键复制</li>
                  <li>图片支持 OCR 文字识别</li>
                </ul>
              </InfoCard>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center py-4">
                <div className="text-5xl mb-3">🧰</div>
                <h3 className="text-lg font-semibold text-foreground">Dev Tools</h3>
                <p className="text-sm text-muted-foreground mt-1">开发者工具箱</p>
                <p className="text-xs text-muted-foreground mt-2">版本 v{version || '...'}</p>
              </div>

              <div className="p-4 bg-card rounded-lg border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">软件更新</p>
                  <button
                    onClick={() => onCheckUpdate()}
                    disabled={checkingUpdate}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                  >
                    {checkingUpdate ? '检查中...' : '检查更新'}
                  </button>
                </div>

                {updateChecked && (
                  <div className="pt-2 border-t border-border">
                    {updateError ? (
                      <div className="flex items-start gap-2">
                        <span className="text-destructive mt-0.5">●</span>
                        <span className="text-sm text-destructive">{updateError}</span>
                      </div>
                    ) : updateInfo ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500">●</span>
                          <span className="text-sm font-medium text-foreground">
                            发现新版本 v{updateInfo.availableVersion}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          v{updateInfo.currentVersion} → v{updateInfo.availableVersion}
                        </p>
                        {updateInfo.notes && (
                          <div className="text-xs text-muted-foreground max-h-32 overflow-auto">
                            <p className="font-medium mb-1">更新内容</p>
                            <pre className="whitespace-pre-wrap">{updateInfo.notes}</pre>
                          </div>
                        )}
                        <button
                          onClick={handleDownloadUpdate}
                          disabled={downloading}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {downloading ? '下载安装中...' : downloadProgress || '更新到最新版本'}
                        </button>
                        {downloadProgress && !downloading && (
                          <p className="text-xs text-muted-foreground mt-2">{downloadProgress}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">●</span>
                        <span className="text-sm text-foreground">已是最新版本</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-card rounded-lg border border-border">
                <p className="text-sm font-medium text-foreground mb-3">功能一览</p>
                <div className="space-y-4">
                  {ABOUT_FEATURE_GROUPS.map((group) => (
                    <div key={group.name}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{group.name}</p>
                      <div className="grid gap-2">
                        {group.items.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-start gap-2.5 rounded-lg bg-secondary/40 px-3 py-2"
                          >
                            <span className="text-base leading-none mt-0.5 shrink-0">{item.icon}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global keyboard listener for shortcut recording */}
      {editingShortcut && (
        <div
          className="fixed inset-0 z-50"
          onKeyDown={(e) => handleShortcutKeyDown(e, editingShortcut)}
          tabIndex={-1}
          autoFocus
        />
      )}
    </div>
  );
}

function SectionTitle({ title, className = '' }: { title: string; className?: string }) {
  return (
    <h3 className={`text-sm font-medium text-muted-foreground ${className}`}>{title}</h3>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <p className="text-sm font-medium text-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

function ThemeSelector({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <p className="text-sm font-medium text-foreground mb-1">主题</p>
      <p className="text-xs text-muted-foreground mb-4">选择应用的外观主题</p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
              theme === option.id
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <span className="text-xl">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingItem({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
      <div className="flex-1 min-w-0 mr-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
