// npm workspacesモノレポ対応。expo等の依存はワークスペースルートにホイストされるため、
// デフォルト設定のままだと `apps/mobile/node_modules` しか見ずエントリポイント解決に失敗する。
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
