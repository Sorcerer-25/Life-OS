const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['.ui-preview/**', '.expo/**', 'android/**', 'ios/**', '.ui-*.cjs'] },
]);
