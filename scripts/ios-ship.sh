#!/bin/bash
# Tars Trading iOS — archive → export → TestFlight, one command, no clicking.
#
# Usage:
#   scripts/ios-ship.sh            # bump build number, archive, upload
#   scripts/ios-ship.sh --archive-only   # stop before upload (signing rehearsal)
#
# Requirements (all already true on this machine):
#   - Xcode signed in, Apple Distribution cert for team XG936GFSKZ
#   - ASC API key at /Volumes/LaCie/tarstrading-secrets/AuthKey_6YQRD5WTYG.p8
#   - App record "Tars Trading" existing in App Store Connect (one-time UI step)
set -euo pipefail

ROOT="/Volumes/LaCie/tarstrading"
DERIVED="/Volumes/LaCie/DerivedData/TarsTrading"
OUT="/Volumes/LaCie/tarstrading-builds"
KEY_ID="6YQRD5WTYG"
ISSUER_ID="305a8772-db6e-4f94-8c69-7c8996a792e7"
KEY_SRC="/Volumes/LaCie/tarstrading-secrets/AuthKey_${KEY_ID}.p8"
TEAM="XG936GFSKZ"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M)
ARCHIVE="$OUT/TarsTrading-$STAMP.xcarchive"
EXPORT_DIR="$OUT/export-$STAMP"

# Build number = seconds since 2026-01-01: strictly increasing, no state file.
BUILD_NUM=$(( $(date +%s) - 1767225600 ))
echo "==> Build number $BUILD_NUM"

echo "==> Archiving (Release, generic iOS device)…"
xcodebuild -project "$ROOT/TarsTrading.xcodeproj" -scheme TarsTrading \
  -destination 'generic/platform=iOS' -configuration Release \
  -derivedDataPath "$DERIVED" -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$BUILD_NUM" \
  archive | grep -E "error:|warning: Signing|ARCHIVE" | tail -5

[ -d "$ARCHIVE" ] || { echo "ARCHIVE FAILED"; exit 1; }
echo "==> Archive OK: $ARCHIVE"

if [[ "${1:-}" == "--archive-only" ]]; then
  echo "==> Stopping before export/upload (--archive-only)."
  exit 0
fi

echo "==> Exporting for App Store Connect…"
PLIST="$OUT/export-options.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>uploadSymbols</key><true/>
</dict></plist>
EOF
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" -exportOptionsPlist "$PLIST" \
  -allowProvisioningUpdates | grep -E "error:|EXPORT" | tail -3

IPA=$(ls "$EXPORT_DIR"/*.ipa | head -1)
[ -f "$IPA" ] || { echo "EXPORT FAILED"; exit 1; }
echo "==> IPA: $IPA"

# altool looks for the key in ./private_keys or ~/private_keys.
mkdir -p ~/private_keys && cp -f "$KEY_SRC" ~/private_keys/

echo "==> Uploading to TestFlight…"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"
echo "==> Uploaded. Processing takes ~5–15 min; the build then appears in TestFlight."
