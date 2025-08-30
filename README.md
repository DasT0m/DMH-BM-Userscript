# DMH BattleMetrics Overlay Enhanced

## 🛡️ Installation Guide

This userscript enhances the BattleMetrics RCON interface with color-coded player information, admin badges, CBL (Community Ban List) integration, SquadJS API monitoring, and quick access buttons.

### ✨ Features

#### Core Enhancements:
- **CBL Integration**: Automatic Community Ban List lookups with color-coded risk ratings
- **Admin Badge System**: Cyan highlighting and shield badges for DMH admins
- **Enhanced RCON Logging**: Color-coded events and actions for better visibility
- **Quick Access Buttons**: Direct links to SOP, MSG, and Rules documents
- **Player Information Tools**: One-click copying of player details and CBL lookup

#### NEW - SquadJS API Integration:
- **Real-time Admin Camera Monitoring**: See which admins are currently in camera mode
- **Player Alert System**: Get instant notifications for recent player alerts requiring attention
- **Live Game State Display**: Current map, round info, and match duration
- **Server Information Panel**: Live player count, server status, and connection info
- **Multi-Server Support**: Switch between multiple servers with dropdown selector
- **Audio Alerts**: Optional sound notifications for critical player alerts
- **Draggable Interface**: Move the monitoring panel anywhere on screen

#### Performance Improvements:
- **Enhanced Caching**: Persistent storage for faster loading and reduced API calls
- **Smart Cache Management**: Automatic cleanup and cache warming from localStorage
- **Optimized Update Intervals**: Reduced from 150ms to 1000ms for better performance
- **Tiered API Updates**: Different update frequencies for different data types

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
     - ⚡ **2.9** (version, black)

3. **Test All Features**
   - Go to the server's player list
   - Player names should be color-coded based on CBL risk ratings
   - Admin players should have cyan highlighting and shield 🛡️ badges
   - Look for the **SquadJS Monitor Panel** in the top-right area
   - The monitoring panel should show:
     - 📹 **Admin Camera Status** (who's currently in camera)
     - 🚨 **Last Player Alert** (recent admin commands/warnings)
     - 🎮 **Game State** (current map, round, duration)
     - 🖥️ **Server Info** (player count, server status)
   - Test **server switching** with the dropdown in the monitor panel
   - Try **dragging the monitor panel** to reposition it

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

### SquadJS Monitor Not Working?
- SquadJS integration requires server-side plugins to be running
- If you see "Server offline" or "No data available" messages, the SquadJS plugins may not be configured on that server
- Try switching servers using the dropdown in the monitor panel
- Check the **API Status** indicator at the bottom of the monitor panel
- The monitor panel can be **dragged** to reposition it if it's blocking other interface elements

### CBL Colors Not Showing?
- CBL integration requires an internet connection
- Some players may not have CBL history (will show as white/clean)
- Check browser console for any network errors

---

## 🎨 Color Guide & Interface Elements

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

### NEW - SquadJS Monitor Panel:
- **📹 Admin Camera**: Shows which admins are currently in camera mode
- **🚨 Last Player Alert**: Recent admin commands that may require attention (with audio alerts)
- **🎮 Game State**: Current map, round number, and match duration
- **🖥️ Server Info**: Live player count and server status
- **🔗 API Status**: Connection indicator (Green=Connected, Yellow=Stale, Red=Disconnected)
- **Server Dropdown**: Switch between multiple servers
- **−/+ Button**: Minimize/maximize the panel
- **Draggable**: Click and drag the header to reposition anywhere on screen

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

### NEW - SquadJS Monitor Panel Usage:
#### Server Management:
- **Switch Servers**: Use dropdown in panel header to select different servers
- **Reposition Panel**: Drag the panel header to move it anywhere on screen
- **Minimize/Maximize**: Use −/+ button to collapse/expand the panel

#### Monitoring Features:
- **Admin Camera Tracking**: See real-time list of admins currently in camera mode
- **Player Alert System**: Get notified of recent admin commands that need attention
- **Audio Notifications**: Hear alert sounds for critical player events (can be disabled)
- **Live Game Data**: Monitor current map rotation, round progress, and match duration
- **Server Health**: Check API connection status and data freshness

#### Alert System:
- Recent player alerts (within 5 minutes) are highlighted in **orange/yellow**
- Audio alerts play for new critical events (respects cooldown to prevent spam)
- Flash notification effect draws attention to new alerts
- Click alerts to see admin name, timestamp, and message details

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

**Version**: 3.6  
**Last Updated**: 2025  
**Compatibility**: Chrome, Firefox, Edge, Opera, Safari (with Tampermonkey)
