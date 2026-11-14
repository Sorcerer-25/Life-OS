const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// SQLite's web worker imports a WebAssembly asset.
config.resolver.assetExts.push('wasm');
module.exports = config;
