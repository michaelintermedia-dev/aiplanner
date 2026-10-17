// Google Play's upload key (2026-10-17). The bundle for Play (.aab) is signed with it when the build is
// run with -PuseUploadKey; the key's file and passwords come from the build machine's
// ~/.gradle/gradle.properties (GATAZEE_UPLOAD_STORE_FILE, _STORE_PASSWORD, _KEY_ALIAS, _KEY_PASSWORD) -
// never from the repo. Without -PuseUploadKey the release build keeps the debug key, so the APK people
// install by hand still updates over the one they have.
const { withAppBuildGradle } = require('expo/config-plugins')

const UPLOAD_CONFIG = `
        upload {
            if (project.hasProperty('GATAZEE_UPLOAD_STORE_FILE')) {
                storeFile file(GATAZEE_UPLOAD_STORE_FILE)
                storePassword GATAZEE_UPLOAD_STORE_PASSWORD
                keyAlias GATAZEE_UPLOAD_KEY_ALIAS
                keyPassword GATAZEE_UPLOAD_KEY_PASSWORD
            }
        }`

module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents
    if (!gradle.includes('GATAZEE_UPLOAD_STORE_FILE')) {
      gradle = gradle.replace(/signingConfigs \{\n(\s*)debug \{/, (m) => m.replace('signingConfigs {', `signingConfigs {${UPLOAD_CONFIG}`))
      gradle = gradle.replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        `$1signingConfig project.hasProperty('useUploadKey') ? signingConfigs.upload : signingConfigs.debug`,
      )
    }
    c.modResults.contents = gradle
    return c
  })
}
