#!/bin/bash

# Create a temporary icon using ImageMagick or sips
# This creates a simple colored icon as a placeholder

# Create a 1024x1024 image using macOS sips
echo "Creating temporary icon..."

# Use python to create a simple PNG (python comes with macOS)
python3 << PYTHON
from PIL import Image, ImageDraw, ImageFont
import os

# Create a 1024x1024 image with a gradient background
img = Image.new('RGB', (1024, 1024), color='#1a1a1a')
draw = ImageDraw.Draw(img)

# Draw a rounded rectangle
def rounded_rectangle(draw, xy, radius, fill):
    x1, y1, x2, y2 = xy
    draw.rectangle([(x1, y1 + radius), (x2, y2 - radius)], fill=fill)
    draw.rectangle([(x1 + radius, y1), (x2 - radius, y2)], fill=fill)
    draw.pieslice([(x1, y1), (x1 + 2*radius, y1 + 2*radius)], 180, 270, fill=fill)
    draw.pieslice([(x2 - 2*radius, y1), (x2, y1 + 2*radius)], 270, 360, fill=fill)
    draw.pieslice([(x1, y2 - 2*radius), (x1 + 2*radius, y2)], 90, 180, fill=fill)
    draw.pieslice([(x2 - 2*radius, y2 - 2*radius), (x2, y2)], 0, 90, fill=fill)

# Draw background
rounded_rectangle(draw, (100, 100, 924, 924), 100, '#10b981')

# Add text (will be basic without custom fonts)
try:
    # Try to use system font
    from PIL import ImageFont
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 400)
except:
    font = ImageFont.load_default()

# Draw "PN" text
text = "PN"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
position = ((1024-text_width)/2, (1024-text_height)/2 - 50)
draw.text(position, text, fill='white', font=font)

# Save the icon
img.save('icon.png')
print("Icon created: icon.png")
PYTHON
