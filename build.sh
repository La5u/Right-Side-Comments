#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./build.sh <version>"
  echo "Example: ./build.sh 2.8.3"
  exit 1
fi

VERSION="$1"
TEMP_DIR="build_temp_$$"

# Remove existing zip files
rm -f right-side-comments-*-*.zip

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TEMP_DIR"

for browser in chromium firefox; do
  echo "Building $browser..."

  # Copy all other files, excluding unwanted ones
  for item in *; do
    case "$item" in
      .git|docs|README.md|build.sh|manifest.json|manifest.*.json|*.zip|build_temp_*|a)
        continue
        ;;
    esac
    cp -r "$item" "$TEMP_DIR/"
  done

  # Copy the appropriate manifest last to ensure it's not overwritten
  cp "manifest.$browser.json" "$TEMP_DIR/manifest.json"

  # Create zip
  zip_name="right-side-comments-$VERSION-$browser.zip"
  cd "$TEMP_DIR"
  zip -r "../$zip_name" .
  cd - > /dev/null

  echo "Created $zip_name"
done

echo "Done!"
