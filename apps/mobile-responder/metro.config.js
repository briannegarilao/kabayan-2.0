const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add 'wasm' to the list of asset extensions Metro understands
config.resolver.assetExts.push("wasm");

// In a monorepo, we need to watch the root node_modules too
// but resolve from local first
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
