import { invoke } from '@/lib/tauri'

export type DbEngine = 'mysql' | 'mariadb'
export type ServiceStatus = 'not_installed' | 'stopped' | 'running' | 'error'

export interface VersionOption {
  id: string
  label: string
  engine: string | null
  downloaded?: boolean
  installed?: boolean
  is_active?: boolean
  port?: number | null
}

export interface StackSettings {
  www_subdir: string
  boot_autostart: Record<string, boolean>
  dashboard_cards: string[]
}

export interface StackEnvInfo {
  site_url: string | null
  www_root: string | null
  mysql_host: string
  mysql_port: number | null
  mysql_user: string
  mysql_password: string
  mariadb_port: number | null
  php_fastcgi: string | null
  composer_cmd: string | null
  python_cmd: string | null
  pip_cmd: string | null
  go_cmd: string | null
  java_cmd: string | null
  node_cmd: string | null
  npm_cmd: string | null
  redis_addr: string | null
  rabbitmq_addr: string | null
  rabbitmq_mgmt_url: string | null
}

export interface ComponentView {
  id: string
  name: string
  selected_version_id: string
  selected_version_label: string
  available_versions: VersionOption[]
  default_port: number
  downloaded: boolean
  download_path: string | null
  installed: boolean
  status: ServiceStatus
  port: number | null
  home_dir: string | null
  pid: number | null
  hint: string | null
  config_path: string | null
  log_path: string | null
  in_system_path: boolean
}

export interface WebSiteView {
  id: string
  name: string
  hostname: string
  root: string
  root_abs: string | null
  enabled: boolean
  is_default: boolean
  url: string | null
  runtime: string
  runtime_label: string
  runtime_version_id: string | null
  web_server: string
  web_server_label: string
  web_server_installed: boolean
  web_server_running: boolean
  runtime_ready: boolean
  port: number | null
  process_running: boolean
}

export interface UpdateSiteParams {
  site_id: string
  name?: string
  hostname?: string
  root?: string
  runtime?: string
  runtime_version_id?: string
  web_server?: string
}

export interface AddSiteParams {
  name: string
  hostname?: string
  root?: string
  runtime?: string
  runtime_version_id?: string
  web_server?: string
}

export const SITE_RUNTIME_OPTIONS = [
  { id: 'php', label: 'PHP', componentId: 'php' },
  { id: 'python', label: 'Python', componentId: 'python' },
  { id: 'go', label: 'Go', componentId: 'go' },
  { id: 'node', label: 'Node.js', componentId: 'node' },
  { id: 'static', label: '静态 HTML', componentId: null },
] as const

export type SiteRuntimeId = (typeof SITE_RUNTIME_OPTIONS)[number]['id']

export interface StackState {
  install_root: string | null
  settings: StackSettings
  env_info: StackEnvInfo
  components: ComponentView[]
  sites: WebSiteView[]
}

export interface DownloadProgress {
  component: string
  version_id: string
  downloaded: number
  total: number | null
  percent: number | null
  phase: string
}

export function downloadProgressKey(component: string, versionId: string): string {
  return `${component}@${versionId}`
}

export interface InstallComponentParams {
  component: string
  source_path?: string
  port?: number
  version_id?: string
  engine?: DbEngine
}

export interface UpdateStackSettingsParams {
  www_subdir?: string
  boot_autostart?: Record<string, boolean>
  dashboard_cards?: string[]
}

export async function getStackState(): Promise<StackState> {
  return invoke('stack_get_state')
}

export async function setInstallRoot(path: string): Promise<StackState> {
  return invoke('stack_set_install_root', { path })
}

export async function setComponentVersion(component: string, versionId: string): Promise<StackState> {
  return invoke('stack_set_component_version', { params: { component, version_id: versionId } })
}

export async function switchComponentVersion(
  component: string,
  versionId: string,
  restart = false,
): Promise<StackState> {
  return invoke('stack_switch_component_version', {
    params: { component, version_id: versionId, restart },
  })
}

export async function pickInstallRoot(): Promise<string | null> {
  return invoke('stack_pick_install_root')
}

export async function pickWwwSubdir(): Promise<string | null> {
  return invoke('stack_pick_www_subdir')
}

export async function pickComponentSource(): Promise<string | null> {
  return invoke('stack_pick_component_source')
}

export async function downloadComponent(component: string, versionId?: string): Promise<StackState> {
  return invoke('stack_download_component', { component, versionId })
}

export async function installComponent(params: InstallComponentParams): Promise<StackState> {
  return invoke('stack_install_component', { params })
}

export async function startComponent(component: string): Promise<StackState> {
  return invoke('stack_start_component', { component })
}

export async function stopComponent(component: string): Promise<StackState> {
  return invoke('stack_stop_component', { component })
}

export async function uninstallComponent(component: string): Promise<StackState> {
  return invoke('stack_uninstall_component', { component })
}

export async function startAllComponents(): Promise<StackState> {
  return invoke('stack_start_all')
}

export async function stopAllComponents(): Promise<StackState> {
  return invoke('stack_stop_all')
}

export async function updateStackSettings(params: UpdateStackSettingsParams): Promise<StackState> {
  return invoke('stack_update_settings', { params })
}

export async function setComponentPort(component: string, port: number): Promise<StackState> {
  return invoke('stack_set_component_port', { params: { component, port } })
}

export async function setComponentBootAutostart(component: string, enabled: boolean): Promise<StackState> {
  return invoke('stack_set_component_boot_autostart', { params: { component, enabled } })
}

// ── 数据库管理 ──

export interface DbInfo {
  name: string
  charset: string
  collation: string
  table_count: number
}

export async function dbCreateDatabase(engine: DbEngine, database: string, charset: string, collation: string): Promise<void> {
  return invoke('db_create_database', { engine, database, charset, collation })
}

export async function dbSetRootPassword(engine: DbEngine, password: string): Promise<void> {
  return invoke('db_set_root_password', { engine, password })
}

export async function dbListDatabases(engine: DbEngine): Promise<DbInfo[]> {
  return invoke('db_list_databases', { engine })
}

export async function dbListTables(engine: DbEngine, database: string): Promise<string[]> {
  return invoke('db_list_tables', { engine, database })
}

export async function dbPickSqlFile(): Promise<string | null> {
  return invoke('db_pick_sql_file')
}

export async function dbPickExportDir(): Promise<string | null> {
  return invoke('db_pick_export_dir')
}

export async function dbImport(engine: DbEngine, database: string, filePath: string): Promise<void> {
  return invoke('db_import', { engine, database, filePath })
}

export async function dbExport(engine: DbEngine, database: string, outputPath: string, tables: string[], gzip: boolean): Promise<void> {
  return invoke('db_export', { params: { engine, database, output_path: outputPath, tables, gzip } })
}

// ── Redis 管理 ──

export async function redisSetPassword(password: string): Promise<void> {
  return invoke('redis_set_password', { password })
}

export async function redisGetPassword(): Promise<string | null> {
  return invoke('redis_get_password')
}

export interface SetPathEnvResult {
  state: StackState
  /** 成功移除的冲突路径 */
  removed: string[]
  /** 需要管理员权限才能移除的系统 PATH 冲突 */
  system_blocked: string[]
}

export async function setComponentPathEnv(component: string, enabled: boolean): Promise<SetPathEnvResult> {
  return invoke('stack_set_component_path_env', { params: { component, enabled } })
}

export async function regenerateConfigs(): Promise<StackState> {
  return invoke('stack_regenerate_configs')
}

export async function openComponentConfig(component: string): Promise<void> {
  return invoke('stack_open_component_config', { component })
}

export async function openComponentLog(component: string): Promise<void> {
  return invoke('stack_open_component_log', { component })
}

export async function openSite(): Promise<void> {
  return invoke('stack_open_site')
}

export async function addSite(params: AddSiteParams): Promise<StackState> {
  return invoke('stack_add_site', { params })
}

export async function updateSite(params: UpdateSiteParams): Promise<StackState> {
  return invoke('stack_update_site', { params })
}

export async function deleteSite(siteId: string): Promise<StackState> {
  return invoke('stack_delete_site', { siteId })
}

export async function setDefaultSite(siteId: string): Promise<StackState> {
  return invoke('stack_set_default_site', { siteId })
}

export async function openSiteById(siteId: string): Promise<void> {
  return invoke('stack_open_site_by_id', { siteId })
}

export async function openSiteRoot(siteId: string): Promise<void> {
  return invoke('stack_open_site_root', { siteId })
}

export async function pickSiteRoot(): Promise<string | null> {
  return invoke('stack_pick_site_root')
}

export async function openInstallRoot(): Promise<void> {
  return invoke('stack_open_install_root')
}

export async function openWwwRoot(): Promise<void> {
  return invoke('stack_open_www_root')
}

export interface SystemMetrics {
  cpu_percent: number
  cpu_system: number
  cpu_user: number
  cpu_idle: number
  memory_used_gb: number
  memory_total_gb: number
  memory_percent: number
  disk_used_gb: number
  disk_total_gb: number
  disk_percent: number
  local_ip: string | null
  net_recv_kbps: number
  net_sent_kbps: number
}

export async function startSite(siteId: string): Promise<StackState> {
  return invoke('stack_start_site', { siteId })
}

export async function stopSite(siteId: string): Promise<StackState> {
  return invoke('stack_stop_site', { siteId })
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  return invoke('system_get_metrics')
}
