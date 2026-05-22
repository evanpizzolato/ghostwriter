#!/bin/bash
# Notarize + staple Ghostwriter DMGs produced by electron-builder.
# electron-builder auto-signs the .app and .dmg during `npm run dist-mac`,
# so this script only handles notarization (which still needs a keychain profile).
#
# As of v0.42 we ship a single universal DMG named `Ghostwriter.dmg` (no version
# in the filename) so the marketing site can link to a stable URL. This script
# notarizes every .dmg under dist/ so it also tolerates older multi-arch layouts.
#
# Prereq (one-time): xcrun notarytool store-credentials "ghostwriter-notarize" \
#                      --apple-id <you@example.com> --team-id 463BF86Y8P --password <app-specific-password>
#
# Usage: ./notarize.sh

set -e

KEYCHAIN_PROFILE="ghostwriter-notarize"

shopt -s nullglob
DMGS=(dist/*.dmg)
shopt -u nullglob

if [ ${#DMGS[@]} -eq 0 ]; then
  echo "No DMGs found in dist/. Run 'npm run dist-mac' first."
  exit 1
fi

notarize_one() {
  local DMG="$1"

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

for DMG in "${DMGS[@]}"; do
  notarize_one "$DMG"
done

echo ""
echo "=========================================="
echo "✅ Done"
echo "=========================================="
ls -lh dist/*.dmg 2>/dev/null || true
