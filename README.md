# DMH BattleMetrics Overlay (PERF Build)

An optimized userscript overlay for **BattleMetrics RCON logs**.  
Highlights admins, color-codes log lines, and provides a draggable/collapsible toolbar.

---

## ✨ Features
- 🛡️ Admin tagging from `admins.json`
- 🔗 Servers dropdown from `servers.json`
- 🎨 Color rules from `color-rules.json`
- 📦 Cached JSON with fallback (works even if GitHub is down)
- ⚡ MutationObserver + debounced updates (better performance)
- 🖱️ Draggable + collapsible toolbar
- 📑 Quick Docs dropdown (SOP, MSG, RUL)
- 🏷️ Version pill (not clickable)

---

## 🔧 Setup
1. Install a userscript manager like **Tampermonkey**.
2. Copy-paste `DMH BattleMetrics Overlay PERF.user.js` into a new script.
3. Create these JSON files in your GitHub repo:
   - `admins.json`
   - `servers.json`
   - `color-rules.json`

### Example: `admins.json`
```json
{
  "admins": ["DasT0m", "Relish", "Birdie"]
}
