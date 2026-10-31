// A staging build of the app (2026-10-31): run the release build with -PstagingApp and the APK is
// "Gatazee Staging" (package com.aiplanner.app.staging), so it installs next to the real app instead
// of replacing it. Point it at staging with EXPO_PUBLIC_API_URL=https://staging.gatazee.com.
// Without the flag nothing changes.
const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins')

const STAGING_CONFIG = `
        // -PstagingApp: "Gatazee Staging", a separate app (plugins/withStagingVariant.js).
        if (project.hasProperty('stagingApp')) {
            applicationIdSuffix '.staging'
            versionNameSuffix '-staging'
            manifestPlaceholders += [appLabel: 'Gatazee Staging']
        } else {
            manifestPlaceholders += [appLabel: '@string/app_name']
        }`

function addToGradle(gradle) {
  if (gradle.includes("hasProperty('stagingApp')")) return gradle
  return gradle.replace(/(defaultConfig \{[\s\S]*?versionName [^\n]*\n)/, `$1${STAGING_CONFIG}\n`)
}

function useLabelPlaceholder(manifestXml) {
  return manifestXml.replace(/(<application[^>]*android:label=")@string\/app_name"/, '$1${appLabel}"')
}

module.exports = function withStagingVariant(config) {
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = addToGradle(c.modResults.contents)
    return c
  })
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0]
    if (app?.$['android:label'] === '@string/app_name') app.$['android:label'] = '${appLabel}'
    return c
  })
}
module.exports.addToGradle = addToGradle
module.exports.useLabelPlaceholder = useLabelPlaceholder
