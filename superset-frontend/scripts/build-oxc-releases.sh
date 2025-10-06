#!/bin/bash
# Build oxlint-superset binaries for all platforms
# This script is used in CI to create release artifacts

set -e

echo "Building oxlint-superset for multiple platforms..."

# Configuration
TARGETS=(
  "x86_64-unknown-linux-gnu"
  "x86_64-apple-darwin"
  "aarch64-apple-darwin"
  "x86_64-pc-windows-msvc"
)

OUTPUT_DIR="release-binaries"
mkdir -p $OUTPUT_DIR

# Install cross-compilation tool if needed
if ! command -v cross &> /dev/null; then
  echo "Installing cross..."
  cargo install cross
fi

# Build for each target
for target in "${TARGETS[@]}"; do
  echo "Building for $target..."
  
  # Map target to output name
  case "$target" in
    x86_64-unknown-linux-gnu)
      output_name="oxlint-superset-linux-x64"
      ;;
    x86_64-apple-darwin)
      output_name="oxlint-superset-darwin-x64"
      ;;
    aarch64-apple-darwin)
      output_name="oxlint-superset-darwin-arm64"
      ;;
    x86_64-pc-windows-msvc)
      output_name="oxlint-superset-win-x64.exe"
      ;;
    *)
      echo "Unknown target: $target"
      continue
      ;;
  esac
  
  # Build with cross for better compatibility
  cross build --release --target $target --bin oxlint
  
  # Copy to output directory
  if [[ "$target" == *"windows"* ]]; then
    cp target/$target/release/oxlint.exe $OUTPUT_DIR/$output_name
  else
    cp target/$target/release/oxlint $OUTPUT_DIR/$output_name
  fi
  
  # Make executable (for non-Windows)
  if [[ "$target" != *"windows"* ]]; then
    chmod +x $OUTPUT_DIR/$output_name
  fi
  
  echo "✅ Built $output_name"
done

echo "🎉 All binaries built successfully!"
ls -la $OUTPUT_DIR/