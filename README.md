# Parental Preferences Activity Guide

A kid-friendly, printable web application that displays activity preferences for Mom and Dad, helping a 5-year-old understand which activities each parent enjoys doing together.

## Features

- 🎨 **Colorful, Kid-Friendly Design**: Large fonts, emojis, and bright colors
- 🔄 **Auto-Update**: Fetches latest data from Google Sheets with one click
- 🖨️ **Print-Ready**: Optimized for 8.5×11" paper with clean black & white printing
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices
- ⚡ **No Server Required**: Runs entirely in the browser

## Quick Start

### ⚠️ Important: Safari Users
If using Safari, you need to run a local web server (see below). **Or simply use Chrome/Firefox** which work immediately!

### Method 1: Chrome or Firefox (Recommended - Easiest)
1. Right-click `index.html` → "Open With" → **Chrome** or **Firefox**
2. View activities organized by category and preference level
3. Click "🔄 Refresh Data" to get latest updates from Google Sheets
4. Click "🖨️ Print" or press Ctrl+P (Cmd+P on Mac) to print

### Method 2: Local Web Server (Required for Safari)
```bash
# In Terminal, navigate to this folder and run:
./start-server.sh

# Then open any browser and go to: http://localhost:8000
```

**Or manually:**
```bash
python3 -m http.server 8000
# Then visit: http://localhost:8000
```

**Why?** Safari blocks API requests from local files for security. Chrome/Firefox are more permissive, or use a local server.

## How It Works

The app connects to your Google Sheet and displays activities organized by:

### Categories
- Arts & Crafts
- Experiential Activities
- Games (Board, Card, Pretend)
- Movies & TV
- Music
- Reading & Educational Activities
- Video Games

### Preference Levels
- **💚 Drop Anything**: Activities Mom or Dad absolutely love to do!
- **💛 Sometimes**: Fun activities they enjoy occasionally
- **⭐ On Your Own**: Activities the child can do independently

### Parent Indicators
- 👩 **Mom**: Mom loves this activity
- 👨 **Dad**: Dad loves this activity
- 👩👨 **Mom & Dad**: Both parents enjoy this activity
- ⭐ **Independent**: Activity to do on your own

## Google Sheet Structure

The app reads from this Google Sheet:
- **Sheet ID**: `143M9nXKYlOo9fourw7c9SHa4C_nLBmCSdqcvJ72cjUE`
- **URL**: https://docs.google.com/spreadsheets/d/143M9nXKYlOo9fourw7c9SHa4C_nLBmCSdqcvJ72cjUE/edit

### Data Format
Each category tab contains:
- Column A: Parent (Mom, Dad, "Mom, Dad", or empty)
- Column B: Category
- Column C: Activity name
- Column D: Preference level (Drop Anything, Sometimes, On Your Own)

## Printing Tips

1. **Browser Print Dialog**: 
   - Chrome/Edge: File → Print (Ctrl+P / Cmd+P)
   - Safari: File → Print (Cmd+P)
   
2. **Print Settings**:
   - Paper size: Letter (8.5 × 11")
   - Orientation: Portrait
   - Margins: Default
   - Background graphics: Optional (colors look great but not required)

3. **Save as PDF**: Most browsers can "Print to PDF" to save a digital copy

## Customization

### Updating Google Sheet Data
Simply edit your Google Sheet and click the "🔄 Refresh Data" button in the app. No need to change any code!

### Changing Categories
To modify which categories are displayed, edit the `CATEGORY_TABS` array in `script.js`:

```javascript
const CATEGORY_TABS = [
    'Arts & Crafts',
    'Experiential',
    // Add or remove categories here
];
```

### Styling Changes
All visual styles are in `styles.css`. You can customize:
- Colors and gradients
- Font sizes and families
- Card layouts
- Print formatting

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Any modern browser with JavaScript enabled

## Technical Details

- **No dependencies**: Pure HTML, CSS, and JavaScript
- **Google Sheets API**: Uses the public Google Visualization API (no authentication required)
- **Responsive CSS Grid**: Automatically adjusts layout for different screen sizes
- **Print CSS**: Special `@media print` rules for optimal paper output

## Troubleshooting

## Troubleshooting

### Problem: "Failed to load data" Error

This usually means the Google Sheet isn't publicly accessible. Follow these steps:

#### Solution 1: Share with "Anyone with the link" (Recommended)

1. Open your [Google Sheet](https://docs.google.com/spreadsheets/d/143M9nXKYlOo9fourw7c9SHa4C_nLBmCSdqcvJ72cjUE/edit)
2. Click the **"Share"** button (top right corner)
3. Under "General access", click the dropdown and select **"Anyone with the link"**
4. Make sure the role is set to **"Viewer"**
5. Click **"Done"**
6. Refresh the app (click "🔄 Refresh Data")

#### Solution 2: Publish to Web (Alternative)

1. Open your Google Sheet
2. Go to **File → Share → Publish to web**
3. Click **"Publish"**
4. Confirm by clicking **"OK"**
5. Refresh the app

#### Still Having Issues?

1. Open `test-connection.html` in your browser to run diagnostics
2. Check the browser console (F12 → Console tab) for detailed error messages
3. Make sure you're connected to the internet
4. Try a different browser (Chrome recommended)

**Problem**: Data not loading
- **Solution**: Check your internet connection and ensure the Google Sheet is public (anyone with link can view)

**Problem**: Print layout looks wrong
- **Solution**: Try different browsers; Chrome and Firefox typically have the best print rendering

**Problem**: Some activities are missing
- **Solution**: Click "🔄 Refresh Data" to fetch the latest version from Google Sheets

## Privacy & Security

- No data is stored locally or sent to any server
- All data fetching happens directly from your browser to Google Sheets
- No tracking, analytics, or third-party services

## Support

For issues or questions, check:
1. Is the Google Sheet URL correct and accessible?
2. Is your browser up to date?
3. Are you connected to the internet?

## License

This project is open source and free to use and modify for personal use.

---

Made with 💜 for family learning time!
