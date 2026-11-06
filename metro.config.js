const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Desactivar Watchman (que tiene un error de librería libfmt.11.dylib en Homebrew)
// para usar el observador nativo FSEvents de macOS de forma instantánea.
config.resolver.useWatchman = false;

// Excluir carpetas de backend y compilación estática para que Metro arranque en < 1s
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
  ? [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`^${path.resolve(__dirname, 'backend').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
  new RegExp(`^${path.resolve(__dirname, 'dist').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
];

module.exports = config;
