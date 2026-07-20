#!/bin/zsh
# Tars Trading → TestFlight, fully from CLI. Mirrors the Persona pipeline:
# archive on the LaCie drive, exportArchive uploads straight to App Store
# Connect using an ASC API key.
#
# Prereqs (one-time):
#   1. App record exists in App Store Connect for com.tarsit.tarstrading
#   2. ASC API key .p8 present + issuer id filled in below (see Persona's
#      pipeline: key BKZVRBPQ5Q worked there; any Admin/App Manager key works)
#   3. Version/build bumped in project.yml (MARKETING_VERSION / CURRENT_PROJECT_VERSION)
set -euo pipefail

REPO=/Volumes/LaCie/tarstrading
BUILD=/Volumes/LaCie/TarsTradingBuild
KEY_ID="${ASC_KEY_ID:?set ASC_KEY_ID}"          # e.g. BKZVRBPQ5Q
ISSUER_ID="${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
KEY_PATH="${ASC_KEY_PATH:?path to AuthKey_$KEY_ID.p8}"

cd "$REPO"
xcodegen generate

ARCHIVE="$BUILD/Archives/TarsTrading-$(date +%Y%m%d-%H%M).xcarchive"
xcodebuild -project TarsTrading.xcodeproj -scheme TarsTrading \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD/DerivedData" \
  -archivePath "$ARCHIVE" \
  archive

cat > /tmp/tars-export.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>XG936GFSKZ</string>
</dict></plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist /tmp/tars-export.plist \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  -authenticationKeyPath "$KEY_PATH" \
  -allowProvisioningUpdates

echo "✅ Uploaded. Check App Store Connect → TestFlight."
