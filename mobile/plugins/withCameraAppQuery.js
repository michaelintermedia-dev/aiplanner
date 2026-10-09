// Lets the app see (and open) Samsung's camera app by its launcher entry - Android 11+
// hides other apps unless they're listed in <queries>. See openCameraApp in src/lib/media.ts.
const { withAndroidManifest } = require('expo/config-plugins')

const PACKAGES = ['com.sec.android.app.camera']

module.exports = function withCameraAppQuery(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest
    manifest.queries = manifest.queries ?? [{}]
    const queries = manifest.queries[0]
    queries.package = queries.package ?? []
    for (const name of PACKAGES) {
      if (!queries.package.some((p) => p.$['android:name'] === name)) queries.package.push({ $: { 'android:name': name } })
    }
    return c
  })
}
