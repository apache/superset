# Extension Icons

This folder should contain the extension icons in the following sizes:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

You can create icons using:

### Option 1: Online Tools
- [Favicon Generator](https://favicon.io/)
- [Icon Generator](https://www.iconsgenerator.com/)
- [Canva](https://www.canva.com/)

### Option 2: Design Software
- Adobe Illustrator
- Figma
- GIMP (free)
- Inkscape (free)

### Option 3: Use Emoji
Quick and easy for development:

1. Go to [Emojipedia](https://emojipedia.org/)
2. Search for "lock" 🔐 or "key" 🔑
3. Download as PNG
4. Resize to 16x16, 48x48, and 128x128

## Design Guidelines

### Recommended Design
- **Theme**: Security/Login
- **Colors**: Purple/Blue gradient (matches popup)
- **Symbol**: Lock 🔐, Key 🔑, or Shield 🛡️
- **Style**: Modern, flat design

### Color Palette (from popup)
- Primary: `#667eea` (purple-blue)
- Secondary: `#764ba2` (purple)
- Success: `#28a745` (green)
- Danger: `#dc3545` (red)

## Temporary Solution

Until you create custom icons, you can:

1. **Use text-based icons**:
   - Create a simple colored square with "SL" text
   - Use online tools like [Placeholder.com](https://placeholder.com/)

2. **Use emoji screenshots**:
   - Take a screenshot of 🔐 emoji
   - Crop and resize to required sizes

3. **Use existing icons**:
   - Find free icons on [Flaticon](https://www.flaticon.com/)
   - Search for "login", "security", or "password"
   - Download and resize

## Quick Icon Creation

### Using Python (if you have it):

```python
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    # Create gradient background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Add text
    font_size = size // 2
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "🔐"
    draw.text((size//4, size//4), text, fill='white', font=font)

    img.save(filename)

create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
```

### Using HTML/Canvas (save as HTML, open in browser):

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="128" height="128"></canvas>
<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Gradient background
const gradient = ctx.createLinearGradient(0, 0, 128, 128);
gradient.addColorStop(0, '#667eea');
gradient.addColorStop(1, '#764ba2');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 128, 128);

// Add emoji
ctx.font = '64px Arial';
ctx.fillText('🔐', 32, 80);

// Right-click canvas and "Save image as..."
</script>
</body>
</html>
```

## Current Status

⚠️ **Icons are missing** - The extension will work but won't have custom icons.

To add icons:
1. Create or download icons
2. Save them in this folder
3. Reload the extension in Chrome

---

**Note**: The extension will work without custom icons, but Chrome will show a default placeholder icon.
