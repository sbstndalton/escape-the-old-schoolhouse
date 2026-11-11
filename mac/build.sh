#!/bin/bash
# Builds "Escape the Old Schoolhouse.app" on a Mac.
# Needs Apple's free Command Line Tools:  xcode-select --install
set -euo pipefail
cd "$(dirname "$0")"

NAME="Escape the Old Schoolhouse"
APP="build/$NAME.app"
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "→ Compiling (Apple Silicon + Intel)…"
swiftc -O -target arm64-apple-macos11  main.swift -o build/game-arm64
swiftc -O -target x86_64-apple-macos11 main.swift -o build/game-x86_64
lipo -create build/game-arm64 build/game-x86_64 -output "$APP/Contents/MacOS/EscapeSchoolhouse"

echo "→ Packaging…"
cp Info.plist "$APP/Contents/Info.plist"
cp ../index.html "$APP/Contents/Resources/index.html"

# App icon: a schoolhouse emoji drawn onto a chalkboard-green tile.
ICONSET=build/AppIcon.iconset; mkdir -p "$ICONSET"
cat > build/icon.swift <<'SWIFT'
import AppKit
let out = CommandLine.arguments[1]
for (px, file) in [(16,"16x16"),(32,"16x16@2x"),(32,"32x32"),(64,"32x32@2x"),(128,"128x128"),(256,"128x128@2x"),(256,"256x256"),(512,"256x256@2x"),(512,"512x512"),(1024,"512x512@2x")] {
  let s = CGFloat(px)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let inset = s * 0.1
  let tile = NSBezierPath(roundedRect: NSRect(x: inset, y: inset, width: s - 2*inset, height: s - 2*inset), xRadius: s*0.18, yRadius: s*0.18)
  NSColor(red: 0.54, green: 0.35, blue: 0.20, alpha: 1).setFill(); tile.fill()
  let inner = NSBezierPath(roundedRect: NSRect(x: inset*1.6, y: inset*1.6, width: s - 3.2*inset, height: s - 3.2*inset), xRadius: s*0.12, yRadius: s*0.12)
  NSColor(red: 0.14, green: 0.25, blue: 0.18, alpha: 1).setFill(); inner.fill()
  let emoji = NSAttributedString(string: "🏫", attributes: [.font: NSFont.systemFont(ofSize: s*0.48)])
  let sz = emoji.size()
  emoji.draw(at: NSPoint(x: (s - sz.width)/2, y: (s - sz.height)/2))
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/icon_\(file).png"))
}
SWIFT
if swiftc -O build/icon.swift -o build/mkicon 2>/dev/null && build/mkicon "$ICONSET" && iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"; then
  echo "→ Icon added"
else
  echo "→ (Skipped icon; the app still works)"
fi

echo "→ Signing (ad-hoc)…"
codesign --force --deep --sign - "$APP"

echo "→ Zipping…"
(cd build && ditto -c -k --keepParent "$NAME.app" "EscapeTheOldSchoolhouse-mac.zip")
rm -rf build/game-* build/icon.swift build/mkicon "$ICONSET"

echo ""
echo "✅ Done!  Your app is at:  mac/$APP"
echo "   Double-click it to play, or drag it into your Applications folder."
