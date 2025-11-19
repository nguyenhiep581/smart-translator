#!/bin/bash
# Create simple PNG icons using ImageMagick or base64 encoded fallback

# Check if ImageMagick is available
if command -v convert &> /dev/null; then
    echo "Using ImageMagick to create PNG icons..."
    convert -size 16x16 -background "#4A90E2" -fill white -gravity center label:"T" icon16.png
    convert -size 32x32 -background "#4A90E2" -fill white -gravity center label:"T" icon32.png
    convert -size 48x48 -background "#4A90E2" -fill white -gravity center label:"T" icon48.png
    convert -size 128x128 -background "#4A90E2" -fill white -gravity center label:"T" icon128.png
    echo "PNG icons created with ImageMagick"
else
    echo "ImageMagick not found. Please install it with: brew install imagemagick"
    echo "Or manually create PNG icons in the public/ folder"
    exit 1
fi
