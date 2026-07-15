use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DbEngine {
    Mysql,
    MariaDb,
}

impl DbEngine {
    pub fn label(self) -> &'static str {
        match self {
            Self::Mysql => "MySQL",
            Self::MariaDb => "MariaDB",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    NotInstalled,
    Stopped,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MysqlInstall {
    pub engine: DbEngine,
    pub version_label: String,
    pub home_dir: String,
    pub port: u16,
    pub initialized: bool,
    #[serde(default)]
    pub pid: Option<u32>,
    #[serde(default)]
    pub root_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NginxInstall {
    pub version_label: String,
    pub home_dir: String,
    pub port: u16,
    #[serde(default)]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhpInstall {
    pub version_label: String,
    pub home_dir: String,
    pub port: u16,
    #[serde(default)]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliInstall {
    pub version_label: String,
    pub home_dir: String,
}

pub type ComposerInstall = CliInstall;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisInstall {
    pub version_label: String,
    pub home_dir: String,
    pub port: u16,
    #[serde(default)]
    pub pid: Option<u32>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RabbitMqInstall {
    pub version_label: String,
    pub home_dir: String,
    pub erlang_home: String,
    pub port: u16,
    pub mgmt_port: u16,
    #[serde(default)]
    pub delayed_plugin: bool,
    #[serde(default)]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RocketMqInstall {
    pub version_label: String,
    pub home_dir: String,
    pub port: u16,
    #[serde(default)]
    pub broker_port: u16,
    #[serde(default)]
    pub pid: Option<u32>,
    #[serde(default)]
    pub namesrv_pid: Option<u32>,
}

fn default_www_subdir() -> String {
    "www/default".into()
}

pub const CLI_COMPONENT_IDS: &[&str] =
    &["composer", "python", "pip", "go", "java", "node", "npm"];

pub fn is_cli_component(component: &str) -> bool {
    CLI_COMPONENT_IDS.contains(&component)
}

pub fn cli_prerequisite(component: &str) -> Option<&'static str> {
    match component {
        "composer" => Some("php"),
        "pip" => Some("python"),
        "npm" => Some("node"),
        _ => None,
    }
}

/// 可加入用户 PATH 的组件（npm 随 Node.js 管理）
pub const PATH_ENV_COMPONENT_IDS: &[&str] = &[
    "nginx",
    "openresty",
    "caddy",
    "php",
    "composer",
    "python",
    "pip",
    "go",
    "java",
    "node",
    "mysql",
    "mariadb",
    "redis",
    "rabbitmq",
    "rocketmq",
    "kafka",
];

pub fn supports_path_env(component: &str) -> bool {
    PATH_ENV_COMPONENT_IDS.contains(&component)
}

/// 仪表盘快捷卡片可选组件（服务类）
pub const DASHBOARD_CARD_IDS: &[&str] = &[
    "nginx",
    "openresty",
    "caddy",
    "php",
    "mysql",
    "mariadb",
    "redis",
    "rabbitmq",
    "rocketmq",
    "kafka",
];

pub fn default_dashboard_cards() -> Vec<String> {
    vec![
        "nginx".into(),
        "php".into(),
        "mysql".into(),
        "redis".into(),
    ]
}

pub fn normalize_dashboard_cards(cards: &[String]) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for id in cards {
        if DASHBOARD_CARD_IDS.contains(&id.as_str()) && !out.iter().any(|x| x == id) {
            out.push(id.clone());
        }
    }
    if out.is_empty() {
        return Err("至少选择一个要在仪表盘显示的服务".into());
    }
    Ok(out)
}

pub const BOOT_COMPONENT_IDS: &[&str] = &[
    "nginx",
    "openresty",
    "caddy",
    "php",
    "mysql",
    "mariadb",
    "redis",
    "rabbitmq",
    "rocketmq",
    "kafka",
];

pub fn all_boot_autostart_map(enabled: bool) -> HashMap<String, bool> {
    BOOT_COMPONENT_IDS
        .iter()
        .map(|id| (id.to_string(), enabled))
        .collect()
}

fn deserialize_boot_autostart<'de, D>(deserializer: D) -> Result<HashMap<String, bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{MapAccess, Visitor};
    use std::fmt;

    struct BootAutostartVisitor;

    impl<'de> Visitor<'de> for BootAutostartVisitor {
        type Value = HashMap<String, bool>;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("bool or map of component boot autostart flags")
        }

        fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E> {
            Ok(all_boot_autostart_map(value))
        }

        fn visit_map<M>(self, mut access: M) -> Result<Self::Value, M::Error>
        where
            M: MapAccess<'de>,
        {
            let mut map = HashMap::new();
            while let Some((key, value)) = access.next_entry::<String, bool>()? {
                map.insert(key, value);
            }
            Ok(map)
        }
    }

    deserializer.deserialize_any(BootAutostartVisitor)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackSettings {
    /// 相对 install_root 的网站目录
    #[serde(default = "default_www_subdir")]
    pub www_subdir: String,
    /// 各组件是否开机自启（任一开启则注册系统开机启动）
    #[serde(default, deserialize_with = "deserialize_boot_autostart")]
    pub boot_autostart: HashMap<String, bool>,
    /// 仪表盘顶部显示的快捷卡片
    #[serde(default = "default_dashboard_cards")]
    pub dashboard_cards: Vec<String>,
    /// 各组件是否已加入用户 PATH
    #[serde(default)]
    pub path_env: HashMap<String, bool>,
}

impl StackSettings {
    pub fn boot_autostart_enabled(&self, component: &str) -> bool {
        self.boot_autostart.get(component).copied().unwrap_or(false)
    }

    pub fn any_boot_autostart(&self) -> bool {
        self.boot_autostart.values().any(|enabled| *enabled)
    }
}

impl Default for StackSettings {
    fn default() -> Self {
        Self {
            www_subdir: default_www_subdir(),
            boot_autostart: HashMap::new(),
            dashboard_cards: default_dashboard_cards(),
            path_env: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSite {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub root: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub is_default: bool,
    /// 站点运行时：php | python | go | node | static
    #[serde(default = "default_site_runtime")]
    pub runtime: String,
    #[serde(default)]
    pub runtime_version_id: Option<String>,
    /// nginx | openresty | apache
    #[serde(default = "default_site_web_server")]
    pub web_server: String,
    /// 运行时进程端口（go / python / node 等需要独立进程的运行时）
    #[serde(default)]
    pub port: Option<u16>,
}

/// 站点运行时进程状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteProcess {
    pub site_id: String,
    pub port: u16,
    pub pid: Option<u32>,
}

fn default_site_runtime() -> String {
    "php".into()
}

fn default_site_web_server() -> String {
    "nginx".into()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSiteView {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub root: String,
    pub root_abs: Option<String>,
    pub enabled: bool,
    pub is_default: bool,
    pub url: Option<String>,
    pub runtime: String,
    pub runtime_label: String,
    pub runtime_version_id: Option<String>,
    pub web_server: String,
    pub web_server_label: String,
    pub web_server_installed: bool,
    pub web_server_running: bool,
    pub runtime_ready: bool,
    /// 站点运行时进程端口
    pub port: Option<u16>,
    /// 站点运行时进程是否在运行
    pub process_running: bool,
}

#[derive(Debug, Deserialize)]
pub struct AddSiteParams {
    pub name: String,
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub root: Option<String>,
    #[serde(default = "default_site_runtime_param")]
    pub runtime: String,
    #[serde(default)]
    pub runtime_version_id: Option<String>,
    #[serde(default = "default_site_web_server_param")]
    pub web_server: String,
}

fn default_site_web_server_param() -> String {
    "nginx".into()
}

fn default_site_runtime_param() -> String {
    "php".into()
}

/// 站点编辑参数 —— 所有字段可选，未提供的保持原值
#[derive(Debug, Deserialize)]
pub struct UpdateSiteParams {
    pub site_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub root: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
    #[serde(default)]
    pub runtime_version_id: Option<String>,
    #[serde(default)]
    pub web_server: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StackStore {
    pub install_root: Option<String>,
    pub mysql: Option<MysqlInstall>,
    pub mariadb: Option<MysqlInstall>,
    pub nginx: Option<NginxInstall>,
    #[serde(default)]
    pub openresty: Option<NginxInstall>,
    #[serde(default)]
    pub php: Option<PhpInstall>,
    #[serde(default)]
    pub composer: Option<CliInstall>,
    #[serde(default)]
    pub python: Option<CliInstall>,
    #[serde(default)]
    pub pip: Option<CliInstall>,
    #[serde(default)]
    pub go: Option<CliInstall>,
    #[serde(default)]
    pub java: Option<CliInstall>,
    #[serde(default)]
    pub node: Option<CliInstall>,
    #[serde(default)]
    pub npm: Option<CliInstall>,
    pub redis: Option<RedisInstall>,
    #[serde(default)]
    pub caddy: Option<NginxInstall>,
    pub rabbitmq: Option<RabbitMqInstall>,
    #[serde(default)]
    pub kafka: Option<NginxInstall>,
    #[serde(default)]
    pub rocketmq: Option<RocketMqInstall>,
    /// 组件 id -> 版本 id
    #[serde(default)]
    pub version_prefs: HashMap<String, String>,
    /// 各软件各版本的下载/安装状态（权威来源：SQLite component_versions）
    #[serde(default)]
    pub version_statuses: Vec<ComponentVersionStatus>,
    #[serde(default)]
    pub settings: StackSettings,
    #[serde(default)]
    pub sites: Vec<WebSite>,
    /// 站点运行时进程（go / python / node）
    #[serde(default)]
    pub site_processes: HashMap<String, SiteProcess>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StackEnvInfo {
    pub site_url: Option<String>,
    pub www_root: Option<String>,
    pub mysql_host: String,
    pub mysql_port: Option<u16>,
    pub mysql_user: String,
    pub mysql_password: String,
    pub mariadb_port: Option<u16>,
    pub php_fastcgi: Option<String>,
    pub composer_cmd: Option<String>,
    pub python_cmd: Option<String>,
    pub pip_cmd: Option<String>,
    pub go_cmd: Option<String>,
    pub java_cmd: Option<String>,
    pub node_cmd: Option<String>,
    pub npm_cmd: Option<String>,
    pub redis_addr: Option<String>,
    pub rabbitmq_addr: Option<String>,
    pub rabbitmq_mgmt_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionOption {
    pub id: String,
    pub label: String,
    pub engine: Option<String>,
    /// 安装包是否已下载到本地缓存
    #[serde(default)]
    pub downloaded: bool,
    /// 该版本是否已安装到磁盘
    #[serde(default)]
    pub installed: bool,
    /// 该版本是否为当前激活（运行/默认）版本
    #[serde(default)]
    pub is_active: bool,
    /// 该版本记住的端口（若适用）
    #[serde(default)]
    pub port: Option<u16>,
}

/// 各软件版本安装/下载状态（持久化到 SQLite）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentVersionStatus {
    pub component_id: String,
    pub version_id: String,
    pub version_label: String,
    pub downloaded: bool,
    pub installed: bool,
    pub is_active: bool,
    pub home_dir: Option<String>,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentView {
    pub id: String,
    pub name: String,
    /// 当前选中的版本 id
    pub selected_version_id: String,
    /// 当前选中的版本显示名
    pub selected_version_label: String,
    pub available_versions: Vec<VersionOption>,
    pub default_port: u16,
    pub downloaded: bool,
    pub download_path: Option<String>,
    pub installed: bool,
    pub status: ServiceStatus,
    pub port: Option<u16>,
    pub home_dir: Option<String>,
    pub pid: Option<u32>,
    pub hint: Option<String>,
    pub config_path: Option<String>,
    pub log_path: Option<String>,
    #[serde(default)]
    pub in_system_path: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackState {
    pub install_root: Option<String>,
    pub settings: StackSettings,
    pub env_info: StackEnvInfo,
    pub components: Vec<ComponentView>,
    pub sites: Vec<WebSiteView>,
}

#[derive(Debug, Deserialize)]
pub struct InstallComponentParams {
    pub component: String,
    #[serde(default)]
    pub source_path: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub version_id: Option<String>,
    #[serde(default)]
    pub engine: Option<DbEngine>,
}

#[derive(Debug, Deserialize)]
pub struct SetComponentVersionParams {
    pub component: String,
    pub version_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SwitchComponentVersionParams {
    pub component: String,
    pub version_id: String,
    #[serde(default)]
    pub restart: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStackSettingsParams {
    pub www_subdir: Option<String>,
    pub boot_autostart: Option<HashMap<String, bool>>,
    pub dashboard_cards: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SetComponentBootAutostartParams {
    pub component: String,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetComponentPortParams {
    pub component: String,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct SetComponentPathEnvParams {
    pub component: String,
    pub enabled: bool,
}

/// PATH 环境变量设置结果（返回给前端）
#[derive(Debug, Clone, Serialize)]
pub struct SetPathEnvResult {
    pub state: StackState,
    /// 成功移除的冲突路径
    pub removed: Vec<String>,
    /// 需要管理员权限才能移除的系统 PATH 冲突路径
    pub system_blocked: Vec<String>,
}
