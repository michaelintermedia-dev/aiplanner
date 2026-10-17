// Google Play (2026-10-17): libraries declare background services the app never starts - background
// audio playback (expo-audio) and background location (expo-location). Play asks every app with such a
// service to justify it (with a video), so they're removed from the app's manifest. Photo/storage and
// overlay permissions are dropped in app.json (android.blockedPermissions).
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

const UNUSED_SERVICES = [
  'expo.modules.audio.service.AudioControlsService',
  'expo.modules.location.services.LocationTaskService',
]

module.exports = function withPlayStoreManifest(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(c.modResults)
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
    app.service = app.service ?? []
    for (const name of UNUSED_SERVICES) {
      app.service = app.service.filter((s) => s.$['android:name'] !== name)
      app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } })
    }
    return c
  })
}
