const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Allow Metro to follow file: links into ../../packages
config.watchFolders = [
  path.resolve(workspaceRoot, "packages"),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];
// Follow symlinks outside the project root
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
