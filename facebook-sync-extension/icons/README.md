# Shoppe Facebook Sync Extension - Icons

Bạn cần tạo 3 file icon PNG với kích thước sau:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)  
- icon128.png (128x128 pixels)

## Cách tạo icon đơn giản:

### Option 1: Sử dụng online tool
1. Truy cập https://www.canva.com hoặc https://favicon.io
2. Tạo icon với:
   - Background: Linear gradient #EE4D2D → #FF6633
   - Text: "S" màu trắng, bold
   - Border radius: 20%
3. Export 3 sizes: 16x16, 48x48, 128x128

### Option 2: Sử dụng ImageMagick (command line)
```bash
# Nếu có ImageMagick installed
convert -size 128x128 \
  -define gradient:angle=135 \
  gradient:'#EE4D2D'-'#FF6633' \
  -fill white -font Arial-Bold -pointsize 80 \
  -gravity center -annotate 0 "S" \
  \( +clone -alpha extract -draw 'fill black polygon 0,0 0,20 20,0 fill white circle 20,20 20,0' \
     \( +clone -flip \) -compose Multiply -composite \
     \( +clone -flop \) -compose Multiply -composite \
  \) -alpha off -compose CopyOpacity -composite \
  icon128.png

convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

### Option 3: Placeholder (để test)
Tạm thời copy bất kỳ PNG nào có kích thước phù hợp để test extension.

## Lưu ý
- Extension sẽ không load được nếu thiếu icon files
- Icon nên có background trong suốt hoặc gradient Shoppe (#EE4D2D)
