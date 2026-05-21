# Ghostwriter Project Handoff

## Project Summary
Ghostwriter is a privacy-focused Electron notes overlay app for macOS built by Evan Pizzolato. It features always-on-top transparency, content protection from screenshots, collapsible sidebar, multi-note management, and global shortcuts.

## Apple Developer Account Details
- **Developer Name:** Evan Pizzolato
- **Team ID:** 463BF86Y8P
- **Certificate:** Developer ID Application: Evan Pizzolato (463BF86Y8P)
- **Keychain Profile for Notarization:** `ghostwriter-notarize`
- **App ID:** com.evanpizzolato.ghostwriter

## What Has Been Completed

### 1. App Icon
- Created new ghost icon at 1024x1024
- Generated `.icns` file with all required sizes in `build/icon.icns`
- Icon is working in builds

### 2. Apple Developer Setup
- Apple Developer Program enrollment completed ($99/year)
- Developer ID Application certificate created and installed
- Apple intermediate certificate (Developer ID - G2) installed for trust chain
- App-specific password created for notarization
- Credentials stored in Keychain with profile name `ghostwriter-notarize`

### 3. Build Configuration
Current `package.json` mac section is configured for unsigned builds (we sign manually):
```json
"mac": {
  "category": "public.app-category.productivity",
  "icon": "build/icon.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "darkModeSupport": true,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "identity": null,
  "notarize": false,
  "target": [
    {
      "target": "dir",
      "arch": ["arm64", "x64", "universal"]
    }
  ]
}
```

### 4. arm64 Build - COMPLETE ✓
- Built, signed, notarized, and stapled
- Final DMG: `dist/Ghostwriter-1.0.0-arm64.dmg`
- Ready for distribution

## What Still Needs To Be Done

### 1. Sign and Notarize x64 Build
The x64 build exists at `dist/mac-x64/Ghostwriter.app` but needs signing and notarization.

### 2. Sign and Notarize Universal Build
The universal build exists at `dist/mac-universal/Ghostwriter.app` but needs signing and notarization.

## Manual Signing Process (electron-builder signing hangs, so we sign manually)

For each build (x64 and universal), the signing order is:

**Step 1: Sign dylibs**
```bash
codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Libraries/libEGL.dylib

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Libraries/libGLESv2.dylib

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Libraries/libffmpeg.dylib

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib
```

**Step 2: Sign helper executables**
```bash
codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Helpers/chrome_crashpad_handler
```

**Step 3: Sign frameworks**
```bash
codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Electron\ Framework.framework

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Mantle.framework

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/ReactiveObjC.framework

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Squirrel.framework
```

**Step 4: Sign helper apps**
```bash
codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist "dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Ghostwriter Helper.app"

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist "dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Ghostwriter Helper (GPU).app"

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist "dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Ghostwriter Helper (Plugin).app"

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist "dist/mac-BUILD/Ghostwriter.app/Contents/Frameworks/Ghostwriter Helper (Renderer).app"
```

**Step 5: Sign main app**
```bash
codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" --options runtime --entitlements build/entitlements.mac.plist dist/mac-BUILD/Ghostwriter.app
```

**Step 6: Verify**
```bash
codesign --verify --deep --strict --verbose=2 dist/mac-BUILD/Ghostwriter.app
```

**Step 7: Create and sign DMG**
```bash
hdiutil create -volname "Ghostwriter" -srcfolder dist/mac-BUILD/Ghostwriter.app -ov -format UDZO dist/Ghostwriter-1.0.0-BUILD.dmg

codesign --force --timestamp --sign "Developer ID Application: Evan Pizzolato (463BF86Y8P)" dist/Ghostwriter-1.0.0-BUILD.dmg
```

**Step 8: Notarize**
```bash
xcrun notarytool submit dist/Ghostwriter-1.0.0-BUILD.dmg --keychain-profile "ghostwriter-notarize" --wait
```

**Step 9: Staple**
```bash
xcrun stapler staple dist/Ghostwriter-1.0.0-BUILD.dmg
```

Replace `BUILD` with `x64` or `universal` as needed.

## Known Issues
- electron-builder's automatic signing hangs indefinitely, which is why we sign manually
- Apple's Notary Service had an outage on Jan 20-21, 2026 causing long delays

## Other Notes
- DevTools toggle line in `main.js` (around line 279 in `createTray()`) should be removed before final distribution
- Project path: `/Users/evanpizzolato/Documents/Code/notesapp/`

## Future Considerations Discussed
- Hosting options: own website, GitHub Releases, or Gumroad
- Code improvements discussed earlier in the conversation (see Complete_Project_Documentation.md for details)
