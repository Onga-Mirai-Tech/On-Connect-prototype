require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ChimeAudioCall'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = ''
  s.homepage       = 'https://github.com'
  s.platforms      = { :ios => '13.4' }
  s.swift_version  = '5.4'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Amazon Chime SDK for iOS（音声のみのため映像コーデック用のAmazonChimeSDKMediaは不要）。
  # バージョンは2026年8月時点の最新確認版。ビルド時にCocoaPods trunkの最新版を確認し、
  # 必要に応じて更新すること。
  s.dependency 'AmazonChimeSDK', '~> 0.25.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,swift}"
end
