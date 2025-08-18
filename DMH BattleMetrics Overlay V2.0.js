// File: DMH Overlay Final V2.js
// ==UserScript==
// @name DMH BattleMetrics Overlay V2.0
// @namespace https://www.battlemetrics.com/
// @version 2.3
// @updateURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20V2.0.js
// @downloadURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20V2.0.js
// @description Modifies the rcon panel for battlemetrics to help color code important events and details about players.
// @author Dast0m & Relish
// @match https://www.battlemetrics.com/*
// @match https://www.battlemetrics.com
// @icon https://www.google.com/s2/favicons?sz=64&domain=battlemetrics.com
// @grant GM_addStyle
// @connect communitybanlist.com
// @connect raw.githubusercontent.com
// @run-at document-end
// ==/UserScript==

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
  version: "2.3",
  updateRate: 150,

  // Server configurations
  servers: [
    { id: "SOP", label: "SOP", url: "https://docs.google.com/document/d/e/2PACX-1vTETPd69RXThe_gTuukFXeeMVTOhMvyzGmyeuXFKkHYd_Cg4CTREEwP2K61u_sWOleMJrkMKwQbBnCB/pub", backgroundColor: "Grey" },
    { id: "MSG", label: "MSG", url: "https://docs.google.com/spreadsheets/d/1hBLYNHUahW3UxxOUJTb1GnZwo3HpmBSFTC3-Nbz-RXk/edit?gid=1852943146#gid=1852943146", backgroundColor: "Green" },
    { id: "Rules", label: "Rules", url: "https://docs.google.com/document/d/e/2PACX-1vQzcm1es81lsxBEnXmSPRlqSS8Wgm04rd0KTmeJn88CN3Lo8pg1sT2-C1WTEXDBJfiDmW7Y6sJwv-Vi/pub", backgroundColor: "Blue" }
  ],

  // Admin list - will be loaded from remote JSON
  adminList: [],

  // API endpoints
  graphqlEndpoint: "https://communitybanlist.com/graphql",
  adminListURL: "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/admins.json"
};

// Color scheme
const COLORS = {
  teamBluefor: "#4eacff",
  teamOpfor: "#d0b1ff",
  teamIndependent: "#fd6aff",
  adminName: "#00fff7",
  bmAdmin: "#58ff47",
  modAction: "#ff3333",
  adminAction: "#37ff00",
  teamKilled: "#ffcc00",
  leftServer: "#d9a6a6",
  joined: "#919191",
  grayed: "#919191",
  tracked: "#FF931A",
  noteColorIcon: "#f5ccff",
  automatedMessage: "#666666"
};

// CSS selectors (centralized for easier updates)
const SELECTORS = {
  // FIX: removed trailing "ddd"
  logContainer: ".ReactVirtualized__Grid__innerScrollContainer",
  logContainerAlt: ".css-b7r34x",
  timeStamp: ".css-z1s6qn",
  playerName: ".css-1ewh5td",
  activityName: ".css-fj458c",
  messageLog: ".css-ym7lu8",
  bmAdmin: ".css-18s4qom",
  bmNoteFlag: ".css-he5ni6",
  playerPageTitle: "#RCONPlayerPage > h1",
  playerPage: "#RCONPlayerPage"
};

// Text matching sets
const TEXT_PATTERNS = {
  teamKilled: new Set(["team killed"]),
  grayedOut: new Set([
    "Testing for now?",
  ]),
  automatedMessages: new Set([
    "Welcome", "Seeding Reward:", "Discord Username:", "Discord.gg/DMH",
    ") by Trigger", "was warned (Discord.gg/DMH)"
  ]),
  trackedTriggers: new Set(["[SL Kit]"]),
  leftServer: new Set(["left the server"]),
  joinedServer: new Set(["joined the server"]),
  actionList: new Set([
    "was warned", "was kicked", "was banned",
    "edited BattleMetrics Ban", "added BattleMetrics Ban", "deleted BattleMetrics Ban",
    "Trigger added flag Previously banned"
  ]),
  teamBluefor: new Set([
    "Australian Defence Force", "British Armed Forces", "Canadian Armed Forces",
    "United States Army", "United States Marine Corps", "Turkish Land Forces"
  ]),
  teamOpfor: new Set([
    "Russian Ground Forces", "Middle Eastern Alliance", "Middle Eastern Insurgents",
    "Insurgent Forces", "Irregular Militia Forces", "People's Liberation Army",
    "Russian Airborne Forces", "PLA Navy Marine Corps", "PLA Amphibious Ground Forces"
    // WPMC removed here
  ]),
  teamIndependent: new Set(["Western Private Military Contractors"]),
  adminTerms: new Set([
    "admin", "Admin", "ADMIN", "aDMIN", "to the other team.", ") was disbanded b",
    "requested a list of squads.", "set the next map to", "changed the map to",
    "requested the next map.", ") forced", "AdminRenameSquad", "(Global)",
    "executed Player Action Action", "requested the current map.", "restarted the match.",
    "Squad disband - SL", "was removed from their squad by Trigger.", "requested layer list.",
    "was removed from their squad by"
  ])
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
const Utils = {
  safeQuery(selector, callback) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) callback(elements);
    } catch (error) {
      console.warn(`Failed to query ${selector}:`, error);
    }
  },
  getTextByTitle(titlePart, defaultValue = "") {
    const element = document.querySelector(`[title*="${titlePart}"]`);
    return element?.innerText || defaultValue;
  },
  copyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  },
  ensureElement(elementId, creationFunction) {
    if (!document.getElementById(elementId)) creationFunction();
  },
  removeElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.remove();
  },
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
};

// ========================================
// STYLE MANAGEMENT
// ========================================
const StyleManager = {
  init() {
    const styles = {
      zShift: ".css-ym7lu8 {z-index: 2;}",
      zShiftTime: ".css-z1s6qn {z-index: 3;}",
      zShiftTimeDate: ".css-1jtoyp {z-index: 3;}",
      teamkillBar: ".css-1tuqie1 {background-color: #5600ff1a;width: 1920px}",
      moderationBar: ".css-1rwnm41 {background-color: #ff000008;width: 1920px;}",
      adminCam: ".css-1fy5con {background-color: #31e3ff21;width: 1920px}",
      nobranding: "#RCONLayout > nav > ul > li.css-1nxi32t > a {background-color: #31e3ff21;width: 1920px}"
    };
    Object.values(styles).forEach(style => GM_addStyle(style));
  },

  addButtonStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes buttonPulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      @keyframes shine { 0% { transform: translateX(-100%) skewX(-15deg); } 100% { transform: translateX(200%) skewX(-15deg); } }
      .bm-player-btn { position: absolute; left: 15px; width: 160px; height: 45px; border: none; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; overflow: hidden; z-index: 99999; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); animation: slideIn 0.5s ease-out; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
      .bm-copy-btn { top: 90px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #4f46e5 100%); color: white; border: 1px solid rgba(255, 255, 255, 0.1); }
      .bm-cbl-btn { top: 145px; background: linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #f59e0b 100%); color: white; border: 1px solid rgba(255, 255, 255, 0.1); }
      .bm-player-btn::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.1) 100%); opacity: 0; transition: opacity 0.3s; }
      .bm-player-btn:hover::before { opacity: 1; }
      .btn-shine { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent); transform: translateX(-100%) skewX(-15deg); transition: none; }
      .bm-player-btn:hover .btn-shine { animation: shine 0.8s ease-out; }
      .bm-player-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3); filter: brightness(1.1); }
      .bm-player-btn:active { animation: buttonPulse 0.2s ease-out; transform: translateY(-1px) scale(0.98); }
      .bm-player-btn .btn-icon { font-size: 16px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)); }
      .bm-player-btn .btn-text { font-weight: 600; letter-spacing: 0.3px; }
      .bm-copy-btn:hover { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%); }
      .bm-cbl-btn:hover { background: linear-gradient(135deg, #fbbf24 0%, #fb923c 50%, #fbbf24 100%); }
      @media (max-width: 768px) { .bm-player-btn { width: 140px; height: 40px; font-size: 12px; } .bm-player-btn .btn-icon { font-size: 14px; } }
    `;
    document.head.appendChild(style);
  }
};

// ========================================
// UI COMPONENTS
// ========================================
const UIComponents = {
  createCornerButtons() {
    const buttonContainer = Object.assign(document.createElement("div"), {
      className: "bm-button-container",
      style: "position: absolute; top: 15px; right: 3%; z-index: 99999; display: flex; gap: 8px; align-items: center;"
    });

    document.body.appendChild(buttonContainer);
    this.addCornerButtonStyles();

    CONFIG.servers.forEach((server) => {
      const button = document.createElement("button");
      button.id = server.id;
      button.className = "bm-corner-btn";
      button.setAttribute('data-tooltip', server.id);

      const icon = this.getButtonIcon(server.label);
      button.innerHTML = `${icon}<span class="btn-text">${server.label}</span>`;

      button.style.setProperty('--btn-color', server.backgroundColor);
      button.addEventListener('click', () => {
        this.animateClick(button);
        window.open(server.url, "_blank");
      });

      buttonContainer.appendChild(button);
    });

    const versionButton = document.createElement("button");
    versionButton.id = "version";
    versionButton.className = "bm-corner-btn bm-version-btn";
    versionButton.setAttribute('data-tooltip', 'Script Version');
    versionButton.innerHTML = `<span class="version-icon">⚡</span><span class="btn-text">${CONFIG.version}</span>`;
    versionButton.style.setProperty('--btn-color', '#1a1a1a');
    versionButton.addEventListener('click', () => {
      this.animateClick(versionButton);
      window.open("https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20V2.0.js", "_blank");
    });
    buttonContainer.appendChild(versionButton);
  },

  getButtonIcon(label) {
    const icons = { '1': '🎮', '2': '🎯', '3': '🚀', 'BAN': '🔨', 'RCN': '⚙️', 'SOP': '📋', 'MSG': '💬', 'Rules': '📖' };
    return `<span class="btn-icon">${icons[label] || '🎲'}</span>`;
  },

  addCornerButtonStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(var(--btn-color-rgb), 0.7); } 70% { box-shadow: 0 0 0 10px rgba(var(--btn-color-rgb), 0); } 100% { box-shadow: 0 0 0 0 rgba(var(--btn-color-rgb), 0); } }
      @keyframes clickWave { 0% { transform: scale(1); } 50% { transform: scale(0.95); } 100% { transform: scale(1); } }
      .bm-corner-btn { position: relative; display: flex; align-items: center; gap: 6px; min-width: 45px; height: 36px; padding: 8px 12px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--btn-color) 0%, color-mix(in srgb, var(--btn-color) 80%, black) 100%); color: white; font-weight: 600; font-size: 11px; cursor: pointer; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); --btn-color-rgb: 255, 255, 255; }
      .bm-corner-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent); transition: left 0.5s; }
      .bm-corner-btn:hover::before { left: 100%; }
      .bm-corner-btn:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3); filter: brightness(1.1); }
      .bm-corner-btn:active { animation: clickWave 0.2s ease-out; }
      .bm-corner-btn .btn-icon { font-size: 14px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)); }
      .bm-corner-btn .btn-text { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .bm-version-btn { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%) !important; border: 1px solid #333; }
      .bm-version-btn .version-icon { animation: pulse 2s infinite; color: #00ff88; }
      .bm-corner-btn::after { content: attr(data-tooltip); position: absolute; bottom: -35px; left: 50%; transform: translateX(-50%); padding: 4px 8px; background: rgba(0, 0, 0, 0.9); color: white; font-size: 10px; border-radius: 4px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.3s; z-index: 100000; }
      .bm-corner-btn:hover::after { opacity: 1; }
      @media (max-width: 768px) { .bm-corner-btn .btn-text { display: none; } .bm-corner-btn { min-width: 36px; padding: 8px; } }
    `;
    document.head.appendChild(style);
  },

  createPlayerButtons() {
    const copyButton = Object.assign(document.createElement("button"), {
      id: "copy-button",
      className: "bm-player-btn bm-copy-btn"
    });

    copyButton.innerHTML = `
      <span class="btn-icon">📋</span>
      <span class="btn-text">Copy Player Info</span>
      <span class="btn-shine"></span>
    `;

    const openURLButton = Object.assign(document.createElement("button"), {
      id: "open-url-button",
      className: "bm-player-btn bm-cbl-btn"
    });

    openURLButton.innerHTML = `
      <span class="btn-icon">🔍</span>
      <span class="btn-text">Open CBL</span>
      <span class="btn-shine"></span>
    `;

    copyButton.addEventListener("click", () => {
      this.animateClick(copyButton);
      const steamID = Utils.getTextByTitle("765", "SteamID MISSING?");
      const eosID = Utils.getTextByTitle("0002", "");
      const playerName = document.querySelector(SELECTORS.playerPageTitle)?.innerText || "NAME MISSING?";

      const urlMatch = window.location.href.match(/players\/(\d+)/);
      const playerID = urlMatch ? urlMatch[1] : "ID_NOT_FOUND";
      const playerURL = `https://www.battlemetrics.com/rcon/players/${playerID}`;

      const textToCopy = `**User**: ${playerName} ${playerURL}\n**IDs**: ${steamID} // ${eosID}`;

      Utils.copyToClipboard(textToCopy);
      this.showCopyFeedback(copyButton);
    });

    openURLButton.addEventListener("click", () => {
      this.animateClick(openURLButton);
      const steamID = Utils.getTextByTitle("765", "SteamID MISSING?");
      if (steamID && steamID !== "SteamID MISSING?") {
        window.open(`https://communitybanlist.com/search/${steamID}`, "_blank");
      } else {
        alert("SteamID is missing or invalid!");
      }
    });

    document.body.appendChild(copyButton);
    document.body.appendChild(openURLButton);

    StyleManager.addButtonStyles();
  },

  animateClick(button) {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => { button.style.transform = ''; }, 150);
  },

  showCopyFeedback(button) {
    const originalText = button.querySelector('.btn-text').textContent;
    const textEl = button.querySelector('.btn-text');
    const iconEl = button.querySelector('.btn-icon');

    textEl.textContent = 'Copied!';
    iconEl.textContent = '✅';
    button.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)';

    setTimeout(() => {
      textEl.textContent = originalText;
      iconEl.textContent = '📋';
      button.style.background = '';
    }, 2000);
  }
};

// ========================================
// ADMIN LIST MANAGER
// ========================================
const AdminListManager = {
  adminRegex: null,

  async loadAdminList() {
    try {
      console.log("Loading admin list from remote source...", CONFIG.adminListURL);
      const response = await fetch(CONFIG.adminListURL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch admin list: ${response.status}`);

      const text = await response.text();
      const data = this.parseFlexibleJSON(text);

      const admins = Array.isArray(data)
        ? data
        : (Array.isArray(data.admins) ? data.admins : []);

      if (!admins.length) throw new Error("Admin list empty or invalid format");

      CONFIG.adminList = admins;
      this.adminRegex = this.buildAdminRegex(admins);

      if (data.updatedAt) console.log(`Admin list updatedAt: ${data.updatedAt}`);
      console.log(`Loaded ${admins.length} admins`);
    } catch (error) {
      console.error("Failed to load admin list from remote source:", error);
      console.log("Using fallback admin list");
      CONFIG.adminList = ["DasT0m", "relish", "ArmyRat60", "XRay", "Del"];
      this.adminRegex = this.buildAdminRegex(CONFIG.adminList);
    }
  },

  parseFlexibleJSON(text) {
    try { return JSON.parse(text.trim()); } catch (_) {}
    try {
      const trimmed = text.replace(/^\uFEFF/, '').trim();
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {}
    const m = text.match(/"admins"\s*:\s*\[(.*?)\]/s);
    if (m) {
      try { return { admins: JSON.parse(`[${m[1]}]`) }; } catch (_) {}
    }
    return { admins: [] };
  },

  buildAdminRegex(names) {
    const esc = names.map(n => Utils.escapeRegExp(n.trim())).filter(Boolean);
    const union = esc.join('|');
    if (!union) return null;
    // Robust around punctuation; optional DMH prefix
    const pattern = `(?:^|\\W)(?:『DMH』\\s?)?(?:${union})(?=\\W|$)`;
    try {
      return new RegExp(pattern, 'iu');
    } catch (e) {
      console.warn('Admin regex build failed; falling back to per-name checks', e);
      return null;
    }
  }
};

// ========================================
// LOG PROCESSING
// ========================================
const LogProcessor = {
  applyTimeStamps() {
    Utils.safeQuery(SELECTORS.timeStamp, elements => {
      elements.forEach(element => {
        const utcTime = element.getAttribute("datetime");
        if (utcTime) {
          const date = new Date(utcTime);
          if (!isNaN(date.getTime())) {
            element.setAttribute("title", date.toLocaleString(undefined, { timeZoneName: "short" }));
          }
        }
      });
    });
  },

  applyLogColoring() {
    const colorMappings = [
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.automatedMessages, color: COLORS.automatedMessage },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.adminTerms, color: COLORS.adminAction },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.grayedOut, color: COLORS.grayed },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.joinedServer, color: COLORS.joined },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.leftServer, color: COLORS.leftServer },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.actionList, color: COLORS.modAction },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.teamBluefor, color: COLORS.teamBluefor },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.teamOpfor, color: COLORS.teamOpfor },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.teamIndependent, color: COLORS.teamIndependent },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.teamKilled, color: COLORS.teamKilled },
      { selector: SELECTORS.messageLog, patterns: TEXT_PATTERNS.trackedTriggers, color: COLORS.tracked }
    ];

    colorMappings.forEach(({ selector, patterns, color }) => {
      this.applyColorToElements(selector, patterns, color);
    });

    // Admin names
    this.applyAdminColors(SELECTORS.activityName);
    this.applyAdminColors(SELECTORS.playerName);

    // BM admin indicators
    Utils.safeQuery(SELECTORS.bmAdmin, elements => {
      elements.forEach(element => {
        if (element.textContent.includes("Admin")) element.style.color = COLORS.bmAdmin;
      });
    });

    // Note flags
    Utils.safeQuery(SELECTORS.bmNoteFlag, elements => {
      elements.forEach(element => { element.style.color = COLORS.noteColorIcon; });
    });
  },

  applyColorToElements(selector, patterns, color) {
    Utils.safeQuery(selector, elements => {
      elements.forEach(element => {
        if (element.style.color && element.style.color !== '') return;
        for (const phrase of patterns) {
          if (element.textContent.includes(phrase)) {
            element.style.color = color;
            if (color === COLORS.automatedMessage) element.style.opacity = "0.6";
            break;
          }
        }
      });
    });
  },

  applyAdminColors(selector) {
    Utils.safeQuery(selector, elements => {
      const regex = AdminListManager.adminRegex;
      if (regex) {
        elements.forEach(element => {
          if (element.style && element.style.color) return; // keep earlier color priority
          if (regex.test(element.textContent)) element.style.color = COLORS.adminName;
        });
        return;
      }
      // Fallback
      elements.forEach(element => {
        if (element.style && element.style.color) return;
        const txt = element.textContent;
        for (const adminName of CONFIG.adminList) {
          const escaped = Utils.escapeRegExp(adminName);
          const re = new RegExp(`(?:^|\\W)(?:『DMH』\\s?)?(?:${escaped})(?=\\W|$)`, 'iu');
          if (re.test(txt)) { element.style.color = COLORS.adminName; break; }
        }
      });
    });
  }
};

// ========================================
// CBL API INTEGRATION
// ========================================
const CBLManager = {
  isFetching: false,

  async fetchPlayerData(steamID) {
    if (this.isFetching) { console.log("CBL script already in progress... Skipping..."); return; }
    if (!steamID || steamID === "SteamID MISSING?") { console.error("Invalid Steam ID"); return; }

    try {
      this.isFetching = true;
      await Utils.delay(500); // rate limiting
      const response = await this.makeGraphQLRequest(steamID);
      const userData = this.parseResponse(response);
      this.displayUserData(userData);
    } catch (error) {
      console.error("Error fetching Steam user data:", error);
      this.displayUserData({ riskRating: "Has no CBL History", activeBans: "N/A", expiredBans: "N/A" });
    } finally {
      this.isFetching = false;
    }
  },

  async makeGraphQLRequest(steamID) {
    const query = `
      query Search($id: String!) {
        steamUser(id: $id) {
          riskRating
          activeBans: bans(orderBy: "created", orderDirection: DESC, expired: false) { edges { node { id } } }
          expiredBans: bans(orderBy: "created", orderDirection: DESC, expired: true) { edges { node { id } } }
        }
      }
    `;
    const response = await fetch(CONFIG.graphqlEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id: steamID } })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  },

  parseResponse(data) {
    if (!data?.data?.steamUser) throw new Error("Invalid response format or user not found");
    const user = data.data.steamUser;
    return {
      riskRating: user.riskRating ?? "None?",
      activeBans: user.activeBans.edges.length,
      expiredBans: user.expiredBans.edges.length
    };
  },

  displayUserData({ riskRating, activeBans, expiredBans }) {
    const cblDiv = document.createElement("div");
    cblDiv.id = "CBL-info";
    cblDiv.style.cssText = `
      width: 140px; height: 120px; left: 15px; top: 210px;
      background: #000000bd; color: white; border: none;
      border-radius: 15%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 8px; position: absolute; text-align: center; z-index: 99998;
    `;

    const riskColor = this.getRiskColor(riskRating);
    const riskNumeric = Number(riskRating);
    const riskDisplay = Number.isFinite(riskNumeric) && riskNumeric >= 1 && riskNumeric <= 10 ? `${riskNumeric}/10` : `${riskRating}`;

    cblDiv.innerHTML = `
      <h4 style="font-size: 1.2em; font-weight: bold; color: ${riskColor}; margin: 4px 0;">CBL Rating</h4>
      <h4 style="font-size: 1em; font-weight: bold; color: ${riskColor}; margin: 4px 0;">${riskDisplay}</h4>
      <h4 style="font-size: 12px; font-weight: bold; margin: 2px 0;">Active Bans: ${activeBans}</h4>
      <h4 style="font-size: 12px; font-weight: bold; margin: 2px 0;">Expired Bans: ${expiredBans}</h4>
    `;

    document.body.appendChild(cblDiv);
  },

  getRiskColor(rating) {
    const n = Number(rating);
    if (Number.isFinite(n)) {
      if (n >= 1 && n <= 5) return "orange";
      if (n > 5) return "red";
      if (n === 0) return "#bfbfbf";
    }
    return "#bfbfbf"; // unknown/None?
  }
};

// ========================================
// DIALOG STYLING
// ========================================
const DialogStyler = {
  styleDialogs() {
    const styleConfigs = {
      modalTitles: [
        { phrase: "Change Layer",     styles: { color: "red",   fontWeight: "bold", fontSize: "200pt" } },
        { phrase: "Set Next Layer",   styles: { color: "lime",  fontWeight: "bold", fontSize: "24pt" } },
        { phrase: "Kick",             styles: { color: "orange",fontWeight: "bold", fontSize: "48pt" } },
        { phrase: "Warn",             styles: { color: "lime",  fontWeight: "bold", fontSize: "24pt" } }
      ],
    };

    setTimeout(() => {
      this.applyStylesToElements(".modal-title", styleConfigs.modalTitles);
      this.applyStylesToElements(".css-4ey69y", styleConfigs.orgGroups);

      const playerMenuSelectors = [".css-f5o5h6 a", ".css-f5o5h6 button", ".css-1ixz43s a", ".css-1ixz43s button"];
      const serverCommandSelectors = [".css-yun63y a", ".css-yun63y button"];

      playerMenuSelectors.forEach(selector => { this.applyPlayerMenuStyles(selector); });
      serverCommandSelectors.forEach(selector => { this.applyServerCommandStyles(selector); });
    }, 500);
  },

  applyStylesToElements(selector, configs) {
    Utils.safeQuery(selector, elements => {
      elements.forEach(element => {
        configs.forEach(({ phrase, styles }) => {
          if (element.textContent.includes(phrase)) Object.assign(element.style, styles);
        });
      });
    });
  },

  applyPlayerMenuStyles(selector) {
    const styles = [
      { phrase: "Warn", styles: { color: "lime" } },
      { phrase: "Squad List", styles: { color: "gold" } },
      { phrase: "Kick", styles: { color: "orange" } },
      { phrase: "Ban", styles: { color: "red" } },
      { phrase: "Force Team Change", styles: { color: "#db4dff" } },
      { phrase: "Remove Player from Squad", styles: { color: "#804d00" } },
      { phrase: "Action - Reset Squad Name", styles: { color: "gold" } }
    ];
    this.applyStylesToElements(selector, styles);
  },

  applyServerCommandStyles(selector) {
    const styles = [
      { phrase: "Next Layer", styles: { color: "lime", fontSize: "16pt" } },
      { phrase: "Change Layer", styles: { color: "red", fontWeight: "bold", fontSize: "8pt" } },
      { phrase: "Squad List", styles: { color: "gold", fontSize: "16pt" } }
    ];
    this.applyStylesToElements(selector, styles);
  }
};

// ========================================
// MAIN UPDATE LOGIC
// ========================================
const MainUpdater = {
  lastPlayerKey: null,

  async update() {
    // Removed extra delay; setInterval controls cadence
    if (!this.isLogContainerPresent()) return;

    LogProcessor.applyTimeStamps();
    LogProcessor.applyLogColoring();
    this.handlePlayerInterface();
    DialogStyler.styleDialogs();
  },

  isLogContainerPresent() {
    return document.querySelector(SELECTORS.logContainer) ||
           document.querySelector(SELECTORS.logContainerAlt);
  },

  handlePlayerInterface() {
    const playerPageExists = document.querySelector(SELECTORS.playerPage);

    if (playerPageExists) {
      Utils.ensureElement("copy-button", () => UIComponents.createPlayerButtons());

      const urlMatch = window.location.href.match(/players\/(\d+)/);
      const playerID = urlMatch ? urlMatch[1] : null;
      const steamID = Utils.getTextByTitle("765", "");
      const playerKey = playerID || steamID || null;

      if (playerKey && playerKey !== this.lastPlayerKey) {
        this.lastPlayerKey = playerKey;
        Utils.removeElement("CBL-info");
        this.fetchCBLData();
      } else {
        Utils.ensureElement("CBL-info", () => this.fetchCBLData());
      }
    } else {
      ["copy-button", "open-url-button", "CBL-info"].forEach(id => { Utils.removeElement(id); });
      this.lastPlayerKey = null;
    }
  },

  async fetchCBLData() {
    const steamID = Utils.getTextByTitle("765", "SteamID MISSING?");
    await CBLManager.fetchPlayerData(steamID);
  }
};

// ========================================
// INITIALIZATION
// ========================================
class BMOverlay {
  constructor() { this.isInitialized = false; }

  async init() {
    if (this.isInitialized) return;
    console.log("Initializing BattleMetrics Overlay...");

    await AdminListManager.loadAdminList();

    StyleManager.init();
    UIComponents.createCornerButtons();

    this.startUpdateLoop();

    this.isInitialized = true;
    console.log("BattleMetrics Overlay initialized successfully");
  }

  startUpdateLoop() {
    setInterval(async () => {
      try {
        await MainUpdater.update();
      } catch (error) {
        console.error("Error in update loop:", error);
      }
    }, CONFIG.updateRate);
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          const targetElements = [
            ".ReactVirtualized__Grid__innerScrollContainer",
            ".navbar-brand"
          ].some(selector => document.querySelector(selector));

          if (targetElements) {
            console.log("Target element detected. Starting initialization...");
            observer.disconnect();
            this.init();
            break;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }
}

// ========================================
// START APPLICATION
// ========================================
const overlay = new BMOverlay();
overlay.observeDOM();
