# DMH BattleMetrics Overlay Enhanced

## 🛡️ Installation Guide

This userscript enhances the BattleMetrics RCON interface with color-coded player information, admin badges, CBL (Community Ban List) integration, and quick access buttons.

### ✨ Features

- **CBL Integration**: Automatic Community Ban List lookups with color-coded risk ratings
- **Admin Badge System**: Cyan highlighting and shield badges for DMH admins
- **Enhanced RCON Logging**: Color-coded events and actions for better visibility
- **Quick Access Buttons**: Direct links to SOP, MSG, and Rules documents
- **Player Information Tools**: One-click copying of player details and CBL lookup

---

## 📦 Step 1: Enable Developer Mode (If Required)

Some browsers may require enabling developer mode for userscripts to function properly.

### Chrome/Chromium:
1. Open **Chrome Settings** (three dots menu → Settings)
2. Go to **Extensions** (or type `chrome://extensions/`)
3. Toggle **"Developer mode"** ON (top-right corner)

### Firefox:
1. Type `about:config` in the address bar
2. Accept the warning prompt
3. Search for `xpinstall.signatures.required`
4. Set it to **false** (double-click to toggle)

### Edge:
1. Open **Edge Settings** (three dots menu → Extensions)
2. Or navigate to `edge://extensions/`
3. Toggle **"Developer mode"** ON (bottom-left)

### Opera:
1. Open **Opera Settings** (Opera menu → Extensions → Extensions)
2. Or navigate to `opera://extensions/`
3. Toggle **"Developer mode"** ON (top-right corner)

### Safari:
1. Go to **Safari** → **Preferences** → **Advanced**
2. Check **"Show Develop menu in menu bar"**
3. Go to **Develop** → **Allow Unsigned Extensions** (if needed)

---

## 🔧 Step 2: Install Tampermonkey

### For Chrome/Chromium Browsers:
1. Open the [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. Click **"Add to Chrome"**
3. Click **"Add extension"** in the popup

### For Firefox:
1. Open the [Firefox Add-ons page](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
2. Click **"Add to Firefox"**
3. Click **"Add"** in the popup

### For Edge:
1. Open the [Microsoft Edge Add-ons store](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
2. Click **"Get"**
3. Click **"Add extension"**

### For Opera:
1. Open the [Opera Add-ons store](https://addons.opera.com/en/extensions/details/tampermonkey-beta/)
2. Click **"Add to Opera"**
3. Click **"Add extension"** in the popup
4. *Alternative*: Opera can also install Chrome extensions from the Chrome Web Store

### For Safari:
1. Open the [Mac App Store](https://apps.apple.com/us/app/tampermonkey/id1482490089)
2. Install Tampermonkey
3. Enable it in Safari Extensions preferences

---

## 🚀 Step 3: Install the DMH Overlay Script

### Method 1: Direct Installation (Recommended)
1. **Open Tampermonkey Dashboard**
   - Click the Tampermonkey icon in your browser
   - Select **"Dashboard"**

2. **Create New Script**
   - Click the **"+"** tab or **"Create a new script"**

3. **Copy and Paste**
   - Delete the default template code
   - Copy the entire DMH Overlay script from this repository
   - Paste it into the editor

4. **Save the Script**
   - Press **Ctrl+S** (or **Cmd+S** on Mac)
   - Or click **File > Save**

### Method 2: Direct Link Installation
1. Click this link: [Install DMH Overlay](https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay.js)
2. Tampermonkey should automatically detect the script
3. Click **"Install"** in the popup

---

## 🎯 Step 4: Verify Installation

1. **Navigate to BattleMetrics**
   - Go to [battlemetrics.com](https://www.battlemetrics.com)
   - Open any server's RCON panel

2. **Look for the Enhancement Buttons**
   - You should see buttons in the top-right area:
     - 📋 **SOP** (grey)
     - 💬 **MSG** (green) 
     - 📖 **Rules** (blue)
     - ⚡ **3.0** (version, black)

3. **Test CBL Integration**
   - Go to the server's player list
   - Player names should be color-coded based on CBL risk ratings
   - Admin players should have cyan highlighting and shield 🛡️ badges

---

## 🔧 Troubleshooting

### Script Not Working?
1. **Check Developer Mode is Enabled**
   - Ensure you completed Step 1 for your browser
   - Some browsers require this for userscripts to function

2. **Check Tampermonkey is Enabled**
   - Click the Tampermonkey icon
   - Ensure it shows "ON" (not "OFF")

2. **Verify Script is Active**
   - Open Tampermonkey Dashboard
   - Find "DMH BattleMetrics Overlay Enhanced"
   - Toggle should be **green/enabled**

3. **Clear Browser Cache**
   - Press **Ctrl+Shift+R** (or **Cmd+Shift+R** on Mac)
   - Or clear your browser's cache manually

4. **Check Console for Errors**
   - Press **F12** to open Developer Tools
   - Go to **Console** tab
   - Look for any red error messages

### Buttons Not Appearing?
- Make sure you're on a BattleMetrics RCON page
- The script only activates on `battlemetrics.com` domains
- Try refreshing the page

### CBL Colors Not Showing?
- CBL integration requires an internet connection
- Some players may not have CBL history (will show as white/clean)
- Check browser console for any network errors

---

## 🎨 Color Guide

### CBL Risk Ratings:
- **🔴 Red**: High risk (6+ rating) or active bans
- **🟠 Orange**: Medium-high risk (3-5 rating)  
- **🟡 Yellow**: Low risk (1-2 rating)
- **⚪ White**: Clean (no CBL history)

### Admin Indicators:
- **🔵 Cyan Background**: DMH Admin with 🛡️ shield badge

### Action Log Colors:
- **🟢 Green**: Admin actions
- **🔴 Red**: Moderation actions (kicks, bans, warnings)
- **🟡 Yellow**: Team kills
- **🔵 Blue**: Team assignments
- **⚫ Grey**: Automated messages and joins/leaves

---

## 📝 Usage Tips

### Quick Player Info Copy:
1. Click on any player in the RCON interface
2. Click the **📋 Copy Player Info** button
3. Information is copied to clipboard in Discord-friendly format

### CBL Lookup:
1. Click on any player in the RCON interface  
2. Click the **🔍 Open CBL** button
3. Opens the player's Community Ban List profile in a new tab

### Document Access:
- **📋 SOP**: Standard Operating Procedures
- **💬 MSG**: Message/Communication Guidelines  
- **📖 Rules**: Server Rules
- **⚡ Version**: Click to check for script updates

---

## 🔄 Updating the Script

The script includes auto-update functionality:

1. **Automatic Updates** (if enabled in Tampermonkey settings)
   - Script will check for updates periodically
   - Updates install automatically

2. **Manual Update Check**
   - Open Tampermonkey Dashboard
   - Click the script name
   - Click **"Check for updates"**

3. **Version Information**
   - Current version is displayed on the ⚡ button
   - Click the version button to view the latest script file

---

## 🆘 Support

If you encounter issues:

1. **Check this README** for common solutions
2. **Report Issues** on the GitHub repository
3. **Contact DMH Staff** in Discord for server-specific questions

---

## ⚖️ Legal & Privacy

- This script only modifies the visual interface of BattleMetrics
- CBL data is fetched from public APIs
- No personal data is collected or transmitted
- Script operates entirely in your browser

---

**Version**: 3.0  
**Last Updated**: 2025  
**Compatibility**: Chrome, Firefox, Edge, Opera, Safari (with Tampermonkey)
