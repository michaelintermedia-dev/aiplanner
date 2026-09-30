// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Code shared with the web app (API types, endpoints, date helpers) lives in
// ../shared. It is a plain folder, not a workspace package, so Metro has to be
// told to watch it. It must stay dependency-free: modules there can't resolve
// anything from this app's node_modules.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')]

module.exports = config
