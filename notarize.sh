#!/bin/bash
# Notarize + staple Ghostwriter DMGs produced by electron-builder.
# electron-builder now auto-signs the .app and .dmg during `npm run dist-mac`,
# so this script only handles notarization (which still needs a keychain profile).
#
# Prereq (one-time): xcrun notarytool store-credentials "ghostwriter-notarize" \
#                      --apple-id <you@example.com> --team-id 463BF86Y8P --password <app-specific-password>
#
# Usage: ./notarize.sh

set -e

VERSION=$(node -p "require('./package.json').version")
KEYCHAIN_PROFILE="ghostwriter-notarize"

ARM64_DMG="dist/Ghostwriter-${VERSION}-arm64.dmg"
X64_DMG="dist/Ghostwriter-${VERSION}.dmg"

notarize_one() {
  local DMG="$1"
  if [ ! -f "$DMG" ]; then
    echo "  skip: $DMG not found"
    return
  fi

  echo ""
  echo "=========================================="
  echo "Notarizing $DMG"
  echo "=========================================="
  xcrun notarytool submit "$DMG" --keychain-profile "$KEYCHAIN_PROFILE" --wait

  echo ""
  echo "Stapling $DMG"
  xcrun stapler staple "$DMG"

  echo ""
  echo "Verifying $DMG"
  xcrun stapler validate "$DMG"
}

notarize_one "$ARM64_DMG"
notarize_one "$X64_DMG"

echo ""
echo "=========================================="
echo "✅ Done"
echo "=========================================="
ls -lh dist/*.dmg 2>/dev/null || true
