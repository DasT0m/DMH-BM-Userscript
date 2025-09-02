# DMH BattleMetrics Overlay Enhanced

## 🛡️ Installation Guide

This userscript enhances the BattleMetrics RCON interface with color-coded player information, admin badges, CBL (Community Ban List) integration, real-time DMH server monitoring, and quick access buttons.

### ✨ Core Features

- **CBL Integration**: Automatic Community Ban List lookups with color-coded risk ratings
- **Admin Badge System**: Cyan highlighting and shield badges for DMH admins
- **Enhanced RCON Logging**: Color-coded events and actions for better visibility
- **Player Information Tools**: One-click copying of player details and CBL lookup
- **DMH Server Monitor**: Real-time admin camera tracking and player alert system
- **Performance Optimizations**: Enhanced caching and persistent storage

---

## 📦 Step 1: Enable Developer Mode (If Required)

Some browsers may require enabling developer mode for userscripts to function properly.

### Chrome/Chromium:
1. Open **Chrome Settings** (three dots menu → Settings)
2. Go to **Extensions** (or type `chrome://extensions/`)
3. Toggle **"Developer mode"** ON (top-right corner)
4. **Additional Chrome Settings** (Required for some users):
   - Find **Tampermonkey** in your extensions list
   - Click **"Details"** on the Tampermonkey extension
   - Enable **"Allow User Scripts"** (toggle ON)
   - Enable **"Allow access to file URLs"** (toggle ON)
   - These options are OFF by default but may be required for proper functionality

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
1. Click this link: [Install DMH Overlay](https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js)
2. Tampermonkey should automatically detect the script
3. Click **"Install"** in the popup

---

## 🎯 Step 4: Verify Installation

1. **Navigate to BattleMetrics**
   - Go to [battlemetrics.com](https://www.battlemetrics.com)
   - Open any DMH server page

2. **Look for the Enhancement Features**
   - **DMH Server Monitor Panel**: Should appear in the top-left area
   - **Color-coded player names** in RCON player lists
   - **Admin badges** (cyan highlighting with shield icons)

3. **Test Core Features**
   - Go to the server's player list
   - Player names should be color-coded based on CBL risk ratings
   - Admin players should have cyan highlighting and shield 🛡️ badges

---

## 🔐 DMH Server Monitor Authentication

The DMH Server Monitor requires Discord authentication to access real-time server data.

### First-Time Setup:
1. **Install the Script** following the steps above
2. Navigate to any **DMH BattleMetrics server page** (e.g., `https://www.battlemetrics.com/servers/squad/XXXXX`)
3. Look for the **DMH Server Monitor** panel (usually top-left corner)
4. Click the **🔐 Login** button in the panel
5. You'll be redirected to Discord OAuth - **authorize the application**
6. After authorization, you'll be redirected back to BattleMetrics
7. **Please be patient** - the connection process may take a moment to complete
8. The panel will show **"Login required"** while establishing the connection
9. Wait up to **30 seconds** for the WebSocket connection to establish
10. The panel should now show **live data** (admin camera status, player alerts)

### Authentication Details:
- **Secure OAuth Flow**: Uses Discord OAuth 2.0 for secure authentication
- **No Passwords Stored**: Your Discord credentials are never stored by the script
- **Automatic Session Management**: Sessions are automatically refreshed when possible
- **Persistent Login**: You only need to login once - sessions persist across browser restarts

### What Data is Accessed:
- **Your Discord username** (for identification)
- **DMH server membership** (to verify access permissions)
- **No message history or personal data** is accessed or stored

---

## 🎨 Interface Guide

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

### DMH Server Monitor Panel:
- **📹 Admin Camera**: Shows which DMH admins are currently in camera mode
- **⚠️ Player Alerts**: Recent !admin commands with expandable history
- **▼/▲ Dropdown Arrow**: Click to show/hide alert history
- **🗑️ Clear History**: Button to clear all stored alerts
- **🔊/🔇 Audio Toggle**: Enable/disable sound notifications
- **📡 API Status**: Connection indicator (WebSocket/Login required/Error)
- **🔗 Quick Links**: Built-in SOP, MSG, Rules, and version buttons
- **🔐 Login**: Discord OAuth authentication
- **🐛 Debug**: System information and troubleshooting
- **💝 Credits**: Development team information
- **−/+ Button**: Minimize/maximize the panel
- **Draggable**: Move panel anywhere with automatic position saving

---

## 📝 Usage Tips

### Player Information:
1. Click on any player in the RCON interface
2. Click the **📋 Copy Player Info** button (player info is copied to clipboard)
3. Click the **🔍 Open CBL** button (opens Community Ban List profile)

### DMH Server Monitor:
- **Authentication**: Click 🔐 to login with Discord OAuth
- **Panel Position**: Drag the header to move it anywhere on screen
- **Alert History**: Click ▼ arrow to expand/collapse recent alerts
- **Audio Control**: Toggle 🔊/🔇 to enable/disable alert sounds
- **Quick Access**: Use built-in buttons for SOP, MSG, Rules, and updates
- **Alert Management**: Click 🗑️ to clear stored alert history

---

## 🔧 Troubleshooting

### Script Not Working?
1. **Check Developer Mode is Enabled**
   - Ensure you completed Step 1 for your browser
   - Some browsers require this for userscripts to function

2. **Chrome Users - Check Additional Settings**
   - Go to `chrome://extensions/`
   - Click **"Details"** on Tampermonkey
   - Ensure **"Allow User Scripts"** is enabled
   - Ensure **"Allow access to file URLs"** is enabled
   - These are often OFF by default and cause functionality issues

3. **Check Tampermonkey is Enabled**
   - Click the Tampermonkey icon
   - Ensure it shows "ON" (not "OFF")

4. **Verify Script is Active**
   - Open Tampermonkey Dashboard
   - Find "DMH BattleMetrics Overlay"
   - Toggle should be **green/enabled**

5. **Clear Browser Cache**
   - Press **Ctrl+Shift+R** (or **Cmd+Shift+R** on Mac)
   - Or clear your browser's cache manually

### DMH Server Monitor Issues?
- **Authentication Required**: Click the **🔐 Login** button to authenticate
- **Connection Status**: Check the "API Status" section in the monitor panel
- **Session Expired**: Click the 🔐 button to refresh your authentication
- **Panel Missing**: Only works on **DMH BattleMetrics server pages**
- **No Data**: Wait up to 30 seconds for WebSocket connection after login

### CBL Colors Not Showing?
- CBL integration requires an internet connection
- Some players may not have CBL history (will show as white/clean)
- Check browser console for any network errors

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
   - Current version is displayed in the Quick Links section of the monitor panel
   - Click the version button to view the latest script file

---

## 🆘 Support

If you encounter issues:

1. **Check this README** for common solutions
2. **Use Debug Button** (🐛) in the monitor panel for system information
3. **Report Issues** on the GitHub repository
4. **Contact DMH Staff** in Discord for server-specific questions

---

## ⚖️ Legal & Privacy

- This script only modifies the visual interface of BattleMetrics
- CBL data is fetched from public APIs
- Discord authentication uses standard OAuth 2.0 protocols
- No personal data is collected or transmitted beyond Discord username
- Script operates entirely in your browser

---

**Version**: 3.7  
**Last Updated**: 2025  
**Compatibility**: Chrome, Firefox, Edge, Opera, Safari (with Tampermonkey)
