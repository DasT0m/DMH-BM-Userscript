// File: DMH Overlay Enhanced.js
// ==UserScript==
// @name DMH BattleMetrics Overlay
// @namespace https://www.battlemetrics.com/
// @version 3.7
// @updateURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js
// @downloadURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js
// @description Modifies the rcon panel for battlemetrics to help color code important events and details about players. Enhanced with CBL player list coloring & virtualization-safe styling, plus admin coloring.
// @author DasT0m, Relish, ArmyRat60, DMH Clan <3
// @match https://www.battlemetrics.com/*
// @match https://www.battlemetrics.com
// @icon https://www.google.com/s2/favicons?sz=64&domain=battlemetrics.com
// @grant GM_addStyle
// @grant GM_setValue
// @grant GM_getValue
// @connect communitybanlist.com
// @connect raw.githubusercontent.com
// @connect *.workers.dev
// @run-at document-end
// ==/UserScript==

// ========================================
// DMH DISCORD AUTH HELPER
// ========================================
const DMH_AUTH = {
  workerOrigin: "https://squadjs-admin-monitor-worker.itsdast0m.workers.dev",
  
  // Storage keys for local storage
  JWT_KEY: "dmh_jwt_token",
  REFRESH_KEY: "dmh_refresh_token",
  EXP_KEY: "dmh_jwt_expires",
  
  // Get JWT token from storage
  get token() { 
    return localStorage.getItem(this.JWT_KEY); 
  },
  
  // Get refresh token from storage
  get refreshToken() { 
    return localStorage.getItem(this.REFRESH_KEY); 
  },
  
  // Get JWT expiration from storage
  get exp() { 
    const exp = localStorage.getItem(this.EXP_KEY);
    return exp ? parseInt(exp) : 0;
  },
  
  // Check if JWT is valid (with 5 minute buffer)
  isValid() { 
    return this.token && Date.now() < (this.exp - 300_000); 
  },

  // Get bearer token for API calls
  bearer() { 
    return this.token ? `Bearer ${this.token}` : null; 
  },
  
  // Store tokens in localStorage
  storeTokens(jwt, refreshToken, expiresAt) {
    localStorage.setItem(this.JWT_KEY, jwt);
    localStorage.setItem(this.REFRESH_KEY, refreshToken);
    localStorage.setItem(this.EXP_KEY, expiresAt.toString());
  },
  
  // Clear tokens from localStorage
  clearTokens() {
    localStorage.removeItem(this.JWT_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.EXP_KEY);
  },
  
  // Check if we have stored tokens
  hasStoredTokens() {
    return this.token && this.refreshToken;
  },
  
  // Cookie helper methods for redirect-based auth
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  },
  
  deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },

  async ensureLogin() {
    // If we have a valid token with comfortable buffer, we're good
            if (this.isValid()) {
          return true;
        }

            // If we have stored tokens but JWT is expired, try to refresh
        if (this.hasStoredTokens()) {
          const refreshOk = await this.directTokenRefresh();
          if (refreshOk) {
            return true;
          }
        }

    // Check URL fragment for redirect-based auth handoff (for initial login)
    if (location.hash && location.hash.includes('dmh_token=')) {
      try {
        const params = new URLSearchParams(location.hash.slice(1));
        const tok = params.get('dmh_token');
        const exp = parseInt(params.get('dmh_exp') || '0', 10);
        const refresh = params.get('dmh_refresh');
        
        if (tok && exp && refresh && Date.now() < (exp - 60000)) {
          // Store both JWT and refresh token
          this.storeTokens(tok, refresh, exp);
          history.replaceState(null, '', location.pathname + location.search);
          return true;
        }
      } catch (error) {
        console.error('[DMH] Error processing redirect hash:', error);
      }
    }

    // Check for temporary cookies from redirect-based auth (legacy support)
    const tempJWT = this.getCookie('DMH_JWT_TEMP');
    const tempUser = this.getCookie('DMH_USER_TEMP');
    const tempExp = this.getCookie('DMH_EXP_TEMP');
    const tempRefresh = this.getCookie('DMH_REFRESH_TEMP');
    
            if (tempJWT && tempExp && tempRefresh) {
          const expiresAt = parseInt(tempExp);
          if (Date.now() < (expiresAt - 60000)) {
            this.storeTokens(tempJWT, tempRefresh, expiresAt);
            this.deleteCookie('DMH_JWT_TEMP');
            this.deleteCookie('DMH_USER_TEMP');
            this.deleteCookie('DMH_EXP_TEMP');
            this.deleteCookie('DMH_REFRESH_TEMP');
            return true;
          } else {
            this.deleteCookie('DMH_JWT_TEMP');
            this.deleteCookie('DMH_USER_TEMP');
            this.deleteCookie('DMH_EXP_TEMP');
            this.deleteCookie('DMH_REFRESH_TEMP');
          }
        }

    // Check legacy localStorage handoff
    const localToken = localStorage.getItem('dmh_session_token');
    const localExp = localStorage.getItem('dmh_session_expires');
    const localRefresh = localStorage.getItem('dmh_session_refresh');
    
            if (localToken && localExp && localRefresh) {
          const expiresAt = parseInt(localExp);
          if (Date.now() < (expiresAt - 60000)) {
            this.storeTokens(localToken, localRefresh, expiresAt);
            localStorage.removeItem('dmh_session_token');
            localStorage.removeItem('dmh_session_expires');
            localStorage.removeItem('dmh_session_refresh');
            localStorage.removeItem('dmh_user_info');
            return true;
          } else {
            localStorage.removeItem('dmh_session_token');
            localStorage.removeItem('dmh_session_expires');
            localStorage.removeItem('dmh_session_refresh');
            localStorage.removeItem('dmH_user_info');
          }
        }

    // If we get here, no valid tokens found
    return false;
  },

  startLogin() {
    // Redirect to Discord OAuth page with return URL
    const returnUrl = encodeURIComponent(location.href);
    const authUrl = `${this.workerOrigin}/auth/start?rt=${returnUrl}`;
    console.log('[DMH] startLogin called, redirecting to:', authUrl);
    window.location.href = authUrl;
  },

  loginPopup() {
    return new Promise((resolve) => {
      const w=480,h=640,left=(screen.width-w)/2,top=(screen.height-h)/2;
      const popup = window.open(`${this.workerOrigin}/auth/start`, "dmh_auth", `width=${w},height=${h},left=${left},top=${top}`);
      const handler = (ev) => {
        if (new URL(this.workerOrigin).origin !== ev.origin) return;
        const { type, token, expiresAt, user, error } = ev.data||{};
        if (type === "dmh_auth") {
          window.removeEventListener("message", handler);
          if (error || !token) return resolve(false);
          GM_setValue(this.tokenKey, token);
          GM_setValue(this.expKey,  expiresAt);
          console.log("[DMH] logged in as", user?.username);
          resolve(true);
        }
      };
      window.addEventListener("message", handler);
    });
  },

  refreshPopup() {
    return new Promise((resolve) => {
      const w=400,h=420,left=(screen.width-w)/2,top=(screen.height-h)/2;
      const popup = window.open(`${this.workerOrigin}/session/refresh`, "dmh_auth_refresh", `width=${w},height=${h},left=${left},top=${top}`);
      const handler = (ev) => {
        // Accept from worker origin
        const { type, token, expiresAt } = ev.data||{};
        if (type === "dmh_auth") {
          window.removeEventListener("message", handler);
          if (!token) return resolve(false);
          GM_setValue(this.tokenKey, token);
          GM_setValue(this.expKey,  expiresAt);
          resolve(true);
        }
      };
      window.addEventListener("message", handler);
    });
  }
  ,
  // Hidden-iframe based silent refresh used by ensureLogin
  silentRefresh() {
    return new Promise((resolve) => {
      try {
        const origin = new URL(this.workerOrigin).origin;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'display:none;width:0;height:0;border:0;';
        iframe.src = `${this.workerOrigin}/session/refresh`;

        let done = false;
        const cleanup = (ok) => {
          if (done) return; done = true;
          window.removeEventListener('message', onMsg);
          try { iframe.remove(); } catch {}
          resolve(!!ok);
        };

        const onMsg = (ev) => {
          if (ev.origin !== origin) return;
          const { type, token, expiresAt } = ev.data || {};
          if (type === 'dmh_auth' && token && expiresAt) {
            console.log('[DMH] Received auth message from silent refresh');
            GM_setValue(this.tokenKey, token);
            GM_setValue(this.expKey, expiresAt);
            cleanup(true);
          }
        };

        window.addEventListener('message', onMsg);
        document.documentElement.appendChild(iframe);
        
        // Safety timeout - increased from 6s to 10s for slower connections
        setTimeout(() => {
          console.log('[DMH] Silent refresh timeout');
          cleanup(false);
        }, 10000);
        
        // Also listen for iframe load errors
        iframe.onerror = () => {
          console.log('[DMH] Silent refresh iframe error');
          cleanup(false);
        };
        
        iframe.onload = () => {
          // Give a bit more time for the postMessage to arrive
          setTimeout(() => {
            if (!done) {
              console.log('[DMH] Silent refresh iframe loaded but no message received');
              cleanup(false);
            }
          }, 2000);
        };
      } catch (error) {
        console.error('[DMH] Silent refresh error:', error);
        resolve(false);
      }
    });
  },

  // NEW: Direct token refresh method using stored refresh token
  async directTokenRefresh() {
    try {
      // Check if we have a stored refresh token
      if (!this.refreshToken) {
        return false;
      }

      // Make a direct request to the refresh endpoint with the stored refresh token
      const response = await fetch(`${this.workerOrigin}/session/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Refresh token is invalid, clear stored tokens
          this.clearTokens();
        }
        return false;
      }

      // Parse the JSON response
      const data = await response.json();
      
              if (data.token && data.expiresAt) {
          // Store the new tokens
          this.storeTokens(data.token, data.refreshToken || this.refreshToken, data.expiresAt);
          return true;
        } else {
          return false;
        }
    } catch (error) {
      console.error('[DMH] Direct token refresh error:', error);
      return false;
    }
  }
};

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
  version: "3.7",
  updateRate: 1000, // Increased from 150ms to 1000ms (1 second) for better performance
  
  // NEW: Cloudflare Worker Integration
  cloudflare: {
    workerBaseUrl: 'https://squadjs-admin-monitor-worker.itsdast0m.workers.dev',
    serverId: null, // Will be auto-detected
    endpoints: {
      overview: '/api/overview',
      status: '/api/status',
      adminActivity: '/api/admin-activity',
      wsToken: '/ws/token'
    }
  },
  
  // NEW: Enhanced caching configuration
  cacheConfig: {
    persistentStorage: true,        // Use localStorage for persistence
    cacheExpiry: 30 * 60 * 1000,   // 30 minutes for CBL data
    adminCacheExpiry: 10 * 60 * 1000, // 10 minutes for admin status
    maxCacheSize: 1000,             // Maximum cache entries
    preloadThreshold: 50,           // Preload when this many players are visible
    aggressiveCaching: true         // Cache more aggressively
  },
  
  // NEW: Audio and alert configuration
  alertConfig: {
    audioEnabled: true,             // Audio alerts enabled by default
    maxAlertHistory: 10,            // Keep last 10 admin commands
    flashDuration: 2000,            // Flash duration in milliseconds
    audioVolume: 0.5,               // Audio volume (0.0 to 1.0)
    alertExpiryMinutes: 20          // Alert history expires after 20 minutes
  },

  servers: [
    { id: "SOP", label: "SOP", url: "https://docs.google.com/document/d/e/2PACX-1vTETPd69RXThe_gTuukFXeeMVTOhMvyzGmyeuXFKkHYd_Cg4CTREEwP2K61u_sWOleMJrkMKwQbBnCB/pub", backgroundColor: "Grey" },
    { id: "MSG", label: "MSG", url: "https://docs.google.com/spreadsheets/d/1hBLYNHUahW3UxxOUJTb1GnZwo3HpmBSFTC3-Nbz-RXk/edit?gid=1852943146#gid=1852943146", backgroundColor: "Green" },
    { id: "Rules", label: "Rules", url: "https://docs.google.com/document/d/e/2PACX-1vQzcm1es81lsxBEnXmSPRlqSS8Wgm04rd0KTmeJn88CN3Lo8pg1sT2-C1WTEXDBJfiDmW7Y6sJwv-Vi/pub", backgroundColor: "Blue" }
  ],

  graphqlEndpoint: "https://communitybanlist.com/graphql"
};

const COLORS = {
  teamBluefor: "#4eacff",
  teamOpfor: "#d0b1ff",
  teamIndependent: "#fd6aff",

  modAction: "#ff3333",
  adminAction: "#37ff00",
  teamKilled: "#ffcc00",
  leftServer: "#d9a6a6",
  joined: "#919191",
  grayed: "#919191",
  tracked: "#FF931A",
  noteColorIcon: "#f5ccff",
  automatedMessage: "#666666",

  // CBL
  cblActiveBan: "#ff3333",
  cblVeryHighRisk: "#ff6666",
  cblHighRisk: "#ff9933",
  cblMediumRisk: "#ffaa00",
  cblLowRisk: "#ffdd00",
  cblClean: "#ffffff",

  // Admin highlight (requested)
  adminCyan: "#00fff7",
  adminCyanBg: "rgba(0, 255, 247, 0.12)"
};

const SELECTORS = {
  logContainer: ".ReactVirtualized__Grid__innerScrollContainer",
  logContainerAlt: ".css-b7r34x",
  timeStamp: ".css-z1s6qn",
  playerName: ".css-1ewh5td",
  messageLog: ".css-ym7lu8",
  bmNoteFlag: ".css-he5ni6",
  playerPageTitle: "#RCONPlayerPage > h1",
  playerPage: "#RCONPlayerPage"
};

const TEXT_PATTERNS = {
  teamKilled: new Set(["team killed"]),
  grayedOut: new Set(["Testing for now?"]),
  automatedMessages: new Set([
    "Welcome","Seeding Reward:","Discord Username:","Discord.gg/DMH",
    ") by Trigger","was warned (Discord.gg/DMH)"
  ]),
  adminWarningMessages: new Set([
    "Remote admin has warned player"
  ]),
  trackedTriggers: new Set(["[SL Kit]"]),
  leftServer: new Set(["left the server"]),
  joinedServer: new Set(["joined the server"]),
  actionList: new Set([
    "was warned","was kicked","was banned",
    "edited BattleMetrics Ban","added BattleMetrics Ban","deleted BattleMetrics Ban",
    "Trigger added flag Previously banned"
  ]),
  teamBluefor: new Set([
    "Australian Defence Force","British Armed Forces","Canadian Armed Forces",
    "United States Army","United States Marine Corps","Turkish Land Forces"
  ]),
  teamOpfor: new Set([
    "Russian Ground Forces","Middle Eastern Alliance","Middle Eastern Insurgents",
    "Insurgent Forces","Irregular Militia Forces","People's Liberation Army",
    "Russian Airborne Forces","PLA Navy Marine Corps","PLA Amphibious Ground Forces"
  ]),
  teamIndependent: new Set(["Western Private Military Contractors"]),
  adminTerms: new Set([
    "admin","Admin","ADMIN","aDMIN","to the other team.",") was disbanded b",
    "requested a list of squads.","set the next map to","changed the map to",
    "requested the next map.",") forced","AdminRenameSquad","(Global)",
    "executed Player Action Action","requested the current map.","restarted the match.",
    "Squad disband - SL","was removed from their squad by Trigger.","requested layer list.",
    "was removed from their squad by"
  ])
};

// ========================================
// UTILS (Enhanced with debugging and cache utilities)
// ========================================
const Utils = {
  safeQuery(selector, cb){ try{ const els=document.querySelectorAll(selector); if(els.length) cb(els);}catch(e){console.warn(`Q fail ${selector}`,e)}},
  getTextByTitle(part,def=""){
    const methods = [
      () => document.querySelector(`[title*="${part}"]`)?.innerText,
      () => document.querySelector(`a[href*="${part}"]`)?.textContent,
      () => {
        const links = document.querySelectorAll('a[href*="steamcommunity.com"]');
        for(const link of links) {
          const match = link.href.match(/(\d{17})/);
          if(match && match[1].startsWith('765')) return match[1];
        }
      },
      () => {
        const steamIdRegex = /(765\d{14,})/;
        const allText = document.body.textContent;
        const match = allText.match(steamIdRegex);
        return match ? match[1] : null;
      }
    ];
    for(const method of methods) {
      try {
        const result = method();
        if(result && result !== def && result.length >= 17) return result;
      } catch(e) { continue; }
    }
    return def;
  },
  copyToClipboard(text){ const ta=document.createElement("textarea"); ta.style.position="fixed"; ta.style.opacity="0"; ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); },
  ensureElement(id, mk){ if(!document.getElementById(id)) mk(); },
  removeElement(id){ document.getElementById(id)?.remove(); },
  delay(ms){ return new Promise(r=>setTimeout(r,ms)); },
  escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); },
  
  // NEW: Enhanced debugging utilities
  debugCacheStatus() {
    // Cache status available via window.DMH_DEBUG.getCacheInfo()
  },
  
  // NEW: Force refresh all styling (global utility)
  forceRefreshAllStyling() {
    MainUpdater.forceRefreshAll();
  },
  
  // NEW: Clear all caches (global utility)
  clearAllCaches() {
    CBLPlayerListManager.reset();
    AdminBadgeDecorator.clearCache();
  }
};

// ========================================
// PERSISTENT STORAGE MANAGER (NEW)
// ========================================
const PersistentStorage = {
  storageKey: 'DMH_BM_CACHE',
  version: '1.0',
  
  // Save cache data to localStorage
  saveCache() {
    if (!CONFIG.cacheConfig.persistentStorage) return;
    
    try {
      const cacheData = {
        version: this.version,
        timestamp: Date.now(),
        cblData: this.serializeCBLData(),
        adminData: this.serializeAdminData(),
        metadata: {
          serverId: this.extractServerId(),
          lastUpdate: Date.now()
        }
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save cache to localStorage:', e);
    }
  },
  
  // Load cache data from localStorage
  loadCache() {
    if (!CONFIG.cacheConfig.persistentStorage) return false;
    
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (!cached) return false;
      
      const cacheData = JSON.parse(cached);
      
      // Version check
      if (cacheData.version !== this.version) {
        this.clearStorage();
        return false;
      }
      
      // Expiry check
      const now = Date.now();
      if (now - cacheData.timestamp > CONFIG.cacheConfig.cacheExpiry) {
        this.clearStorage();
        return false;
      }
      
      // Server ID check (only restore if same server)
      if (cacheData.metadata?.serverId !== this.extractServerId()) {
        return false;
      }
      
      // Restore caches
      this.deserializeCBLData(cacheData.cblData);
      this.deserializeAdminData(cacheData.adminData);
      
      return true;
      
    } catch (e) {
      console.warn('Failed to load cache from localStorage:', e);
      this.clearStorage();
      return false;
    }
  },
  
  // Serialize CBL data for storage
  serializeCBLData() {
    const serialized = {};
    for (const [steamID, data] of CBLPlayerListManager.cblCache.entries()) {
      serialized[steamID] = {
        ...data,
        timestamp: Date.now()
      };
    }
    return serialized;
  },
  
  // Deserialize CBL data from storage
  deserializeCBLData(data) {
    CBLPlayerListManager.cblCache.clear();
    for (const [steamID, entry] of Object.entries(data)) {
      CBLPlayerListManager.cblCache.set(steamID, entry);
      CBLPlayerListManager.processedSteamIDs.add(steamID);
    }
  },
  
  // Serialize admin data for storage
  serializeAdminData() {
    const serialized = {};
    for (const [steamID, data] of AdminBadgeDecorator.adminCache.entries()) {
      serialized[steamID] = data;
    }
    return serialized;
  },
  
  // Deserialize admin data from storage
  deserializeAdminData(data) {
    AdminBadgeDecorator.adminCache.clear();
    for (const [steamID, entry] of Object.entries(data)) {
      AdminBadgeDecorator.adminCache.set(steamID, entry);
    }
  },
  
  // Extract server ID from current URL
  extractServerId() {
    const match = location.href.match(/\/rcon\/servers\/(\d+)/);
    return match ? match[1] : null;
  },
  
  // Clear localStorage
  clearStorage() {
    try {
      localStorage.removeItem(this.storageKey);

    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  },
  
  // Get cache statistics
  getStats() {
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (!cached) return { size: 0, age: 0 };
      
      const data = JSON.parse(cached);
      const size = new Blob([cached]).size;
      const age = Date.now() - data.timestamp;
      
      return {
        size: size,
        age: age,
        cblEntries: Object.keys(data.cblData || {}).length,
        adminEntries: Object.keys(data.adminData || {}).length,
        serverId: data.metadata?.serverId
      };
    } catch (e) {
      return { size: 0, age: 0, error: e.message };
    }
  }
};

// ========================================
// STYLES
// ========================================
const StyleManager = {
  init(){
    const styles = {
      zShift: ".css-ym7lu8{z-index:2;}","zShiftTime":".css-z1s6qn{z-index:3;}",
      zShiftTimeDate:".css-1jtoyp{z-index:3;}",
      teamkillBar:".css-1tuqie1{background-color:#5600ff1a;width:100vw}",
      moderationBar:".css-1rwnm41{background-color:#ff000008;width:100vw;}",
      adminCam:".css-1fy5con{background-color:#31e3ff21;width:100vw}",
      nobranding:"#RCONLayout > nav > ul > li.css-1nxi32t > a{background-color:#31e3ff21;width:100vw}"
    };
    Object.values(styles).forEach(s=>GM_addStyle(s));
    this.addCBLPlayerListStyles();
    this.addAdminBadgeStyles();
    this.addCloudflareOverlayStyles();
  },
  addCBLPlayerListStyles(){
    GM_addStyle(`
      tbody tr:hover{background-color:rgba(255,255,255,.05)!important;}
      .cbl-risk-high{box-shadow:0 0 5px rgba(255,51,51,.5)!important;}
      .cbl-risk-medium{box-shadow:0 0 3px rgba(255,153,51,.5)!important;}
      .cbl-active-ban{box-shadow:0 0 8px rgba(255,51,51,.8);}
      .cbl-player-name{transition:all .3s ease;}
      .cbl-player-name:hover{transform:scale(1.02);}
      .cbl-ban-indicator{font-size:12px;margin-left:4px;filter:drop-shadow(0 0 2px rgba(255,51,51,.8));}
    `);
  },
  addAdminBadgeStyles(){
    GM_addStyle(`
      .dmh-admin-shield{margin-left:4px; font-size:12px; filter:drop-shadow(0 0 2px rgba(0,0,0,.4));}
      .dmh-admin-name{
        color:${COLORS.adminCyan} !important;
        background:${COLORS.adminCyanBg} !important;
        padding:2px 4px !important;
        border-radius:3px !important;
        text-shadow:0 0 3px rgba(0,255,247,.4) !important;
      }
    `);
  },
  
  addCloudflareOverlayStyles(){
    GM_addStyle(`
      .dmh-overlay {
        position: fixed;
        top: 20px;
        left: 20px;
        width: 320px;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(0, 255, 247, 0.3);
        border-radius: 12px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 100000;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        cursor: grab;
      }
      
      .dmh-overlay:hover {
        border-color: rgba(0, 255, 247, 0.6);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
      }
      
      .dmh-overlay.collapsed {
        width: 320px;
        height: 50px;
      }
      
      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 18px;
        background: linear-gradient(135deg, rgba(0, 255, 247, 0.1), rgba(0, 255, 247, 0.05));
        border-radius: 12px 12px 0 0;
        border-bottom: 1px solid rgba(0, 255, 247, 0.2);
      }
      
      .overlay-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        font-size: 15px;
      }
      
      .title-icon {
        color: #00fff7;
        font-size: 18px;
      }
      
      .overlay-controls {
        display: flex;
        gap: 6px;
      }
      
      .overlay-btn {
        background: rgba(0, 255, 247, 0.1);
        border: 1px solid rgba(0, 255, 247, 0.3);
        color: #00fff7;
        border-radius: 6px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 13px;
      }
      
      .overlay-btn:hover {
        background: rgba(0, 255, 247, 0.2);
        border-color: rgba(0, 255, 247, 0.5);
        transform: scale(1.05);
      }
      
      /* Audio toggle button states */
      .audio-toggle-btn.audio-off {
        background: rgba(255, 0, 0, 0.1);
        border-color: rgba(255, 0, 0, 0.3);
        color: #ff6666;
      }
      
      .audio-toggle-btn.audio-off:hover {
        background: rgba(255, 0, 0, 0.2);
        border-color: rgba(255, 0, 0, 0.5);
      }
      
      /* Alert flashing effects */
      .alert-flash {
        animation: alertFlash 2s ease-out;
      }
      
      @keyframes alertFlash {
        0% { 
          background: rgba(255, 0, 0, 0.3);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
          transform: scale(1.02);
        }
        50% { 
          background: rgba(255, 0, 0, 0.2);
          box-shadow: 0 0 15px rgba(255, 0, 0, 0.6);
          transform: scale(1.01);
        }
        100% { 
          background: transparent;
          box-shadow: none;
          transform: scale(1);
        }
      }
      
      /* Dropdown arrow styling */
      .dropdown-arrow {
        margin-left: auto;
        cursor: pointer;
        color: #00fff7;
        font-size: 14px;
        transition: all 0.2s ease;
        user-select: none;
      }
      
      .dropdown-arrow:hover {
        color: #ffffff;
        transform: scale(1.1);
      }
      
      /* Alert history styling */
      .alert-history {
        max-height: 200px;
        overflow-y: auto;
        margin-top: 8px;
        border-top: 1px solid rgba(255, 0, 0, 0.2);
        padding-top: 8px;
      }
      
      .alert-history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding: 0 4px;
      }
      
      .history-title {
        font-weight: 600;
        color: #ff6666;
        font-size: 12px;
      }
      
      .history-count {
        color: #888;
        font-size: 11px;
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 10px;
      }
      
      .alert-history-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .alert-history-item {
        background: rgba(255, 0, 0, 0.1);
        border-left: 3px solid #ff6666;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      
      .alert-history-item:hover {
        background: rgba(255, 0, 0, 0.15);
        transform: translateX(2px);
      }
      
      /* Quick Links section styling */
      .quick-links-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 8px;
      }
      
      .quick-link-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        min-height: 36px;
      }
      
      .quick-link-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.1);
      }
      
      .quick-link-btn:active {
        transform: scale(0.98);
      }
      
      .quick-link-btn .btn-icon,
      .quick-link-btn .version-icon {
        font-size: 14px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }
      
      .quick-link-btn .btn-text {
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      /* Button color variants */
      .sop-btn {
        background: linear-gradient(135deg, #666666 0%, #555555 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .msg-btn {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .rules-btn {
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .version-btn {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .version-btn .version-icon {
        animation: pulse 2s infinite;
        color: #00ff88;
      }
      
      .alert-history-item:last-child {
        margin-bottom: 0;
      }
      
      .alert-history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
        font-size: 11px;
      }
      
      .alert-history-player {
        font-weight: bold;
        color: #ff6666;
      }
      
      .alert-history-time {
        font-size: 10px;
        color: #999;
      }
      
      .alert-history-message {
        color: #ccc;
        font-style: italic;
        font-size: 10px;
      }
      
      .overlay-content {
        padding: 20px;
      }
      
      .overlay-section {
        margin-bottom: 24px;
      }
      
      .overlay-section:last-child {
        margin-bottom: 0;
      }
      
      .overlay-section h4 {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 600;
        color: #00fff7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .section-icon {
        font-size: 14px;
        opacity: 0.8;
      }
      
      .info-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        font-size: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .info-item:last-child {
        border-bottom: none;
      }
      
      .info-label {
        color: #ccc;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .info-value {
        color: white;
        font-weight: 600;
        text-align: right;
        max-width: 200px;
        word-wrap: break-word;
      }
      
      .admin-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }


      
      .admin-entry {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        font-size: 12px;
      }
      
      .admin-icon {
        color: #ffaa00;
        font-size: 14px;
      }
      
      .admin-name {
        color: white;
        font-weight: 500;
      }
      
      .alert-entry {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .alert-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      
      .alert-icon {
        color: #ff4444;
        font-size: 14px;
      }
      
      .alert-player {
        color: white;
        font-weight: 500;
      }
      
      .alert-time {
        color: #888;
        font-size: 11px;
      }
      
      .alert-message {
        color: #ccc;
        font-size: 11px;
        font-family: monospace;
        background: rgba(255, 255, 255, 0.05);
        padding: 4px 8px;
        border-radius: 4px;
        margin-left: 22px;
        border-left: 2px solid rgba(255, 68, 68, 0.3);
      }
      
      .status-note {
        font-size: 10px;
        color: #ffaa00;
        margin-top: 12px;
        text-align: center;
        padding: 8px;
        background: rgba(255, 170, 0, 0.1);
        border-radius: 6px;
        border: 1px solid rgba(255, 170, 0, 0.2);
      }
      
      .overlay-footer {
        display: flex;
        justify-content: center;
        gap: 10px;
        padding: 16px 18px;
        border-top: 1px solid rgba(0, 255, 247, 0.2);
        border-radius: 0 0 12px 12px;
      }
      
      .overlay-footer .overlay-btn {
        width: 36px;
        height: 36px;
        font-size: 16px;
      }
      
      .dmh-overlay.collapsed .overlay-content,
      .dmh-overlay.collapsed .overlay-footer {
        display: none;
      }
      
      .websocket-connected {
        color: #00ff88 !important;
        font-weight: 700;
      }
      
      .websocket-error {
        color: #ff4444 !important;
        font-style: italic;
      }
      
      .websocket-connecting {
        color: #ffaa00 !important;
        font-weight: 600;
      }
      
      .connection-websocket {
        border-color: rgba(0, 255, 136, 0.5) !important;
      }
      
      .connection-error {
        border-color: rgba(255, 68, 68, 0.5) !important;
      }
      
      .connection-disconnected {
        border-color: rgba(255, 170, 0, 0.5) !important;
      }
      
      @media (max-width: 768px) {
        .dmh-overlay {
          width: 340px;
          left: 10px;
          top: 10px;
        }
      }
    `);
  },
  addButtonStyles(){
    const style=document.createElement("style");
    style.innerHTML=`
      @keyframes slideIn{from{opacity:0;transform:translateX(-20px);}to{opacity:1;transform:translateX(0);}}
      @keyframes buttonPulse{0%{transform:scale(1);}50%{transform:scale(1.05);}100%{transform:scale(1);}}
      @keyframes shine{0%{transform:translateX(-100%) skewX(-15deg);}100%{transform:translateX(200%) skewX(-15deg);}}
      .bm-player-btn{position:absolute;left:15px;width:160px;height:45px;border:none;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;overflow:hidden;z-index:99999;transition:all .3s cubic-bezier(.4,0,.2,1);box-shadow:0 6px 20px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(10px);animation:slideIn .5s ease-out;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;text-shadow:0 1px 2px rgba(0,0,0,.2);}
      .bm-copy-btn{top:90px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#4f46e5 100%);color:white;border:1px solid rgba(255,255,255,.1);}
      .bm-cbl-btn{top:145px;background:linear-gradient(135deg,#f59e0b 0%,#f97316 50%,#f59e0b 100%);color:white;border:1px solid rgba(255,255,255,.1);}
      .bm-player-btn::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(255,255,255,.1) 0%,transparent 50%,rgba(255,255,255,.1) 100%);opacity:0;transition:opacity .3s;}
      .bm-player-btn:hover::before{opacity:1;}
      .btn-shine{position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-100%) skewX(-15deg);}
      .bm-player-btn:hover .btn-shine{animation:shine .8s ease-out;}
      .bm-player-btn:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 12px 30px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.3);filter:brightness(1.1);}
      .bm-player-btn:active{animation:buttonPulse .2s ease-out;transform:translateY(-1px) scale(.98);}
      .bm-player-btn .btn-icon{font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));}
      .bm-player-btn .btn-text{font-weight:600;letter-spacing:.3px;}
      .bm-copy-btn:hover{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#6366f1 100%);}
      .bm-cbl-btn:hover{background:linear-gradient(135deg,#fbbf24 0%,#fb923c 50%,#fbbf24 100%);}
      @media(max-width:768px){.bm-player-btn{width:140px;height:40px;font-size:12px}.bm-player-btn .btn-icon{font-size:14px}}
    `;
    document.head.appendChild(style);
  }
};

// ========================================
// UI (buttons)
// ========================================
const UIComponents = {
  createPlayerButtons(){
    const copyBtn=Object.assign(document.createElement("button"),{id:"copy-button",className:"bm-player-btn bm-copy-btn"});
    copyBtn.innerHTML=`<span class="btn-icon">📋</span><span class="btn-text">Copy Player Info</span><span class="btn-shine"></span>`;
    const cblBtn=Object.assign(document.createElement("button"),{id:"open-url-button",className:"bm-player-btn bm-cbl-btn"});
    cblBtn.innerHTML=`<span class="btn-icon">🔍</span><span class="btn-text">Open CBL</span><span class="btn-shine"></span>`;
    copyBtn.addEventListener("click",()=>{this.animateClick(copyBtn); const steamID=Utils.getTextByTitle("765","SteamID MISSING?"); const eosID=Utils.getTextByTitle("0002",""); const name=document.querySelector(SELECTORS.playerPageTitle)?.innerText||"NAME MISSING?"; const m=location.href.match(/players\/(\d+)/); const pid=m?m[1]:"ID_NOT_FOUND"; const url=`https://www.battlemetrics.com/rcon/players/${pid}`; Utils.copyToClipboard(`**User**: ${name} ${url}\n**IDs**: ${steamID} // ${eosID}`); this.showCopyFeedback(copyBtn);});
    cblBtn.addEventListener("click",()=>{
      this.animateClick(cblBtn);
      const steamID=Utils.getTextByTitle("765","");
      if(steamID && steamID.length >= 17 && /^765\d{14,}$/.test(steamID)){
        window.open(`https://communitybanlist.com/search/${steamID}`,"_blank");
      } else {
        console.warn('Steam ID extraction failed. Trying alternative methods...');
        const steamLink = document.querySelector('a[href*="steamcommunity.com"]');
        if(steamLink) {
          const match = steamLink.href.match(/(\d{17})/);
          if(match && match[1].startsWith('765')) {
            window.open(`https://communitybanlist.com/search/${match[1]}`,"_blank");
            return;
          }
        }
        alert("Unable to find valid Steam ID for CBL lookup!");
      }
    });
    document.body.appendChild(copyBtn); document.body.appendChild(cblBtn); StyleManager.addButtonStyles();
  },
  animateClick(b){ b.style.transform='scale(0.95)'; setTimeout(()=>b.style.transform='',150); },
  showCopyFeedback(b){ const t=b.querySelector('.btn-text'), i=b.querySelector('.btn-icon'), orig=t.textContent; t.textContent='Copied!'; i.textContent='✅'; b.style.background='linear-gradient(135deg,#00ff88 0%,#00cc66 100%)'; setTimeout(()=>{t.textContent=orig;i.textContent='📋';b.style.background='';},2000); }
};

// ========================================
// CBL MANAGER (API + panel)
// ========================================
const CBLManager = {
  isFetching:false,
  async fetchPlayerData(steamID){
    if(this.isFetching) return;
    if(!steamID||steamID==="SteamID MISSING?"){ console.error("Invalid Steam ID"); return; }
    try{
      this.isFetching=true; await Utils.delay(500);
      const res=await this.makeGraphQLRequest(steamID);
      const data=this.parseResponse(res); this.displayUserData(data);
    }catch(e){
      console.error("CBL fetch error:",e);
      this.displayUserData({riskRating:"Has no CBL History",activeBans:"N/A",expiredBans:"N/A"});
    }finally{ this.isFetching=false; }
  },
  async makeGraphQLRequest(steamID){
    const query=`query Search($id:String!){ steamUser(id:$id){ riskRating activeBans:bans(orderBy:"created",orderDirection:DESC,expired:false){edges{node{id}}} expiredBans:bans(orderBy:"created",orderDirection:DESC,expired:true){edges{node{id}}} } }`;
    const res=await fetch(CONFIG.graphqlEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables:{id:steamID}})});
    if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`); return res.json();
  },
  parseResponse(d){ if(!d?.data?.steamUser) return {riskRating:0,activeBans:0,expiredBans:0}; const u=d.data.steamUser; return {riskRating:u.riskRating??0,activeBans:u.activeBans?.edges?.length??0,expiredBans:u.expiredBans?.edges?.length??0}; },
  displayUserData({riskRating,activeBans,expiredBans}){
    Utils.removeElement("CBL-info");
    const div=document.createElement("div"); div.id="CBL-info";
    div.style.cssText="width:140px;height:120px;left:15px;top:210px;background:#000000bd;color:#fff;border:none;border-radius:15%;box-shadow:0 4px 6px rgba(0,0,0,.1);padding:8px;position:absolute;text-align:center;z-index:99998;";
    const color=this.getRiskColor(riskRating); const n=Number(riskRating); const disp=Number.isFinite(n)&&n>=1&&n<=10?`${n}/10`:`${riskRating}`;
    div.innerHTML=`<h4 style="font-size:1.2em;font-weight:bold;color:${color};margin:4px 0;">CBL Rating</h4>
      <h4 style="font-size:1em;font-weight:bold;color:${color};margin:4px 0;">${disp}</h4>
      <h4 style="font-size:12px;font-weight:bold;margin:2px 0;">Active Bans: ${activeBans}</h4>
      <h4 style="font-size:12px;font-weight:bold;margin:2px 0;">Expired Bans: ${expiredBans}</h4>`;
    document.body.appendChild(div);
  },
  getRiskColor(r){ const n=Number(r); if(Number.isFinite(n)){ if(n>=1&&n<=5) return "orange"; if(n>5) return "red"; if(n===0) return "#bfbfbf"; } return "#bfbfbf"; }
};

// ========================================
// ADMIN BADGE DECORATOR (Enhanced with robust caching)
// ========================================
const AdminBadgeDecorator = {
  PURPLE_RGB: "rgb(208, 58, 250)", // from your screenshot
  SHIELD_HTML: ' <span class="dmh-admin-shield" title="DMH Admin">🛡️</span>',
  
  // Enhanced: Better cache for admin status
  adminCache: new Map(), // steamID -> { isAdmin: boolean, timestamp: number }
  adminElements: new WeakSet(), // track which elements we've decorated
  elementAdminCache: new Map(), // element -> steamID for reverse lookup

  // Detects "[DMH] Admin" flame/icon near the name
  hasAdminFlame(row){
    try{
      // Match by title plus the purple fill (robust to DOM refactors)
      const byTitle = row.querySelector('span[title*="Admin" i], [title*="[DMH] Admin" i]');
      if (!byTitle) return false;

      // Prefer explicit color check if present
      const style = (byTitle.getAttribute('style') || '').toLowerCase();
      if (style.includes('fill') || style.includes('color')) {
        if (style.includes(this.PURPLE_RGB)) return true;
      }

      // Also allow SVG/icon descendants with that fill
      const svg = byTitle.querySelector('svg, path, use');
      if (svg) {
        const fill = (svg.getAttribute('fill') || '').toLowerCase();
        if (fill.includes('208') && fill.includes('58') && fill.includes('250')) return true;
      }

      // Fallback: if title says Admin and the element is in the small icon cluster near the name
      return true;
    }catch{ return false; }
  },

  // Apply cyan highlight + shield, overriding prior color (e.g., CBL)
  decorateName(nameEl, steamID = null){
    if (!nameEl) return;
    
    // Avoid duplicate shields
    if (!nameEl.querySelector('.dmh-admin-shield')) {
      nameEl.insertAdjacentHTML('beforeend', this.SHIELD_HTML);
    }
    
    // Mark as decorated to avoid re-processing
    this.adminElements.add(nameEl);
    
    // Store reverse lookup for cache management
    if (steamID) {
      this.elementAdminCache.set(nameEl, steamID);
    }
    
    // Cyan highlight (match your scheme)
    const imp=(el,p,v)=>el.style.setProperty(p,v,'important');
    imp(nameEl,'color',COLORS.adminCyan);
    imp(nameEl,'background-color',COLORS.adminCyanBg);
    imp(nameEl,'padding','2px 4px');
    imp(nameEl,'border-radius','3px');
    imp(nameEl,'text-shadow','0 0 3px rgba(0,255,247,.4)');
    // Slight weight bump
    imp(nameEl,'font-weight','600');
    // Helpful tooltip
    if (!nameEl.title?.includes('DMH Admin')) {
      nameEl.title = (nameEl.title ? nameEl.title + '\n' : '') + 'DMH Admin';
    }
  },

  // Enhanced: Check cache first, then detect and cache result
  isAdminCached(steamID, row) {
    if (!steamID) return false;
    
    // Check cache first
    if (this.adminCache.has(steamID)) {
      const cacheEntry = this.adminCache.get(steamID);
      // Check if cache is still valid (5 minutes)
      if (Date.now() - cacheEntry.timestamp < 5 * 60 * 1000) {
        return cacheEntry.isAdmin;
      }
      // Cache expired, remove it
      this.adminCache.delete(steamID);
    }
    
    // Not in cache, detect and store
    const isAdmin = this.hasAdminFlame(row);
    this.adminCache.set(steamID, {
      isAdmin: isAdmin,
      timestamp: Date.now()
    });
    
    if (isAdmin) {

    }
    
    return isAdmin;
  },

  // Enhanced: Apply decoration from cache (fast path)
  applyFromCache(nameEl, steamID) {
    if (!nameEl || !steamID) return false;
    
    const cacheEntry = this.adminCache.get(steamID);
    if (cacheEntry && cacheEntry.isAdmin && !this.adminElements.has(nameEl)) {
      this.decorateName(nameEl, steamID);
      return true;
    }
    return false;
  },

  // Enhanced: Check if element needs re-decoration
  needsRedecoration(nameEl) {
    if (!nameEl) return false;
    
    // Check if admin shield is missing
    if (!nameEl.querySelector('.dmh-admin-shield')) return true;
    
    // Check if admin styling is missing
    const currentColor = nameEl.style.getPropertyValue('color');
    if (!currentColor || !currentColor.includes('00fff7')) return true;
    
    return false;
  },

  // Enhanced main method with better caching
  maybeDecorate(row, nameEl, steamID = null){
    if (!row || !nameEl) return;
    
    // If we already decorated this element and it still looks good, skip
    if (this.adminElements.has(nameEl) && !this.needsRedecoration(nameEl)) return;
    
    // Try cache first if we have steamID
    if (steamID && this.applyFromCache(nameEl, steamID)) {
      return;
    }
    
    // Check if admin and cache the result
    if (steamID) {
      const isAdmin = this.isAdminCached(steamID, row);
      if (isAdmin) {
        this.decorateName(nameEl, steamID);
      }
    } else {
      // Fallback for when we don't have steamID
      if (this.hasAdminFlame(row)) {
        this.decorateName(nameEl);
      }
    }
  },

  // Enhanced: Clear caches (useful for debugging or reset)
  clearCache() {
    this.adminCache.clear();
    this.adminElements = new WeakSet();
    this.elementAdminCache.clear();

  },

  // NEW: Clean up expired cache entries
  cleanupCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [steamID, cacheEntry] of this.adminCache.entries()) {
      if (now - cacheEntry.timestamp > maxAge) {
        this.adminCache.delete(steamID);
      }
    }
    
    
  },

  // NEW: Force refresh admin badges for all visible elements
  forceRefreshAll() {
    try {
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let refreshed = 0;
      
      rows.forEach(row => {
        const steamID = CBLPlayerListManager.extractSteamID(row);
        const nameEl = CBLPlayerListManager.extractNameElement(row);
        
        if (!nameEl || !steamID) return;
        
        const cacheEntry = this.adminCache.get(steamID);
        if (cacheEntry && cacheEntry.isAdmin) {
          this.decorateName(nameEl, steamID);
          refreshed++;
        }
      });
      

    } catch (e) {
      console.warn('Admin force refresh error:', e);
    }
  }
};

// ========================================
// CBL PLAYER LIST (Enhanced with robust caching)
// ========================================
const CBLPlayerListManager = {
  processedPlayers: new Set(),
  cblCache: new Map(),
  coloredElements: new WeakSet(),
  processedSteamIDs: new Set(),
  isProcessing: false,
  lastProcessTime: 0,
  listObserver: null,
  cacheWarmed: false, // NEW: Track if cache has been warmed from storage
  
  // NEW: Enhanced caching for better persistence
  elementCache: new Map(), // steamID -> { element, timestamp, data }
  scrollObserver: null,
  lastScrollTime: 0,
  scrollThrottle: 100, // ms

  observePlayerListContainer(){
    if(this.listObserver) return;
    const container =
      document.querySelector('.ReactVirtualized__Grid__innerScrollContainer') ||
      document.querySelector('[data-testid="player-table"]') ||
      document.querySelector('[role="grid"]') ||
      document.querySelector('tbody');
    if(!container) return;

    // NEW: Observe scroll events for better cache management
    this.setupScrollObserver(container);

    this.listObserver = new MutationObserver(muts => {
      for(const m of muts){
        if(m.type === 'childList'){
          m.addedNodes.forEach(node => {
            if(node.nodeType !== 1) return;
            if(!this.tryProcessNode(node)){
              node.querySelectorAll?.('div[role="row"], tr, div[data-session]').forEach(r => this.tryProcessNode(r));
            }
          });
        }
      }
    });
    this.listObserver.observe(container, {childList: true, subtree: true});

  },

  // NEW: Setup scroll observer for better cache management
  setupScrollObserver(container) {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }

    this.scrollObserver = new MutationObserver(() => {
      const now = Date.now();
      if (now - this.lastScrollTime > this.scrollThrottle) {
        this.lastScrollTime = now;
        this.handleScrollEvent();
      }
    });

    // Also listen for actual scroll events
    container.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - this.lastScrollTime > this.scrollThrottle) {
        this.lastScrollTime = now;
        this.handleScrollEvent();
      }
    }, { passive: true });


  },

  // NEW: Handle scroll events to refresh styling
  handleScrollEvent() {
    // Debounced scroll handling to refresh visible elements
    setTimeout(() => {
      this.refreshVisibleElements();
    }, 50);
  },

  // NEW: Refresh styling for visible elements
  refreshVisibleElements() {
    try {
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let refreshed = 0;
      
      rows.forEach(row => {
        const steamID = this.extractSteamID(row);
        const nameEl = this.extractNameElement(row);
        
        if (!nameEl || !steamID) return;
        
        // Check if we have cached data for this steamID
        const cached = this.cblCache.get(steamID);
        if (cached) {
          // Reapply CBL styling
          this.applyPlayerNameColor(nameEl, cached);
          
          // Reapply admin badge if needed
          AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
          
          refreshed++;
        }
      });
      

    } catch (e) {
      console.warn('CBL scroll refresh error:', e);
    }
  },

  tryProcessNode(node){
    try{
      if(!(node instanceof Element)) return false;
      const role = node.getAttribute('role');
      if(!(role === 'row' || node.matches('tr') || node.hasAttribute('data-session'))) return false;
      this.processPlayerRow(node);
      return true;
    }catch{ return false; }
  },

  async processPlayerList(){
    if(this.isProcessing) return;
    if(!window.location.href.match(/\/rcon\/servers\/\d+(?:\/.*)?$/)) return;

    const now = Date.now();
    if(now - this.lastProcessTime < 10000) return; // 10s window

    try{
      this.isProcessing = true; 
      this.lastProcessTime = now;
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let count = 0;
      for(const r of rows){ 
        if(await this.processPlayerRow(r)) count++; 
      }

    }catch(e){ console.error("CBL list scan error:", e); }
    finally{ this.isProcessing = false; }
  },

  fastRescan(){
    try{
      this.observePlayerListContainer?.();
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let applied = 0;
      
      rows.forEach(row => {
        const steamID = this.extractSteamID(row);
        const nameEl = this.extractNameElement(row);
        if(!nameEl) return;
        
        // Enhanced: Always reapply styling for cached data
        if(steamID){
          const cached = this.cblCache.get(steamID);
          if(cached){
            this.applyPlayerNameColor(nameEl, cached);
            // NEW: Update element cache
            this.elementCache.set(steamID, {
              element: nameEl,
              timestamp: Date.now(),
              data: cached
            });
          }
          
          // Always check admin status from cache
          AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
        } else {
          // Fallback admin check without steamID
          AdminBadgeDecorator.maybeDecorate(row, nameEl);
        }
        
        // Mark as processed
        this.coloredElements.add(nameEl);
        applied++;
      });
      
      this.lastProcessTime = 0;

    }catch(e){
      console.warn('CBL fastRescan error:', e);
    }
  },

  async processPlayerRow(row){
    try{
      const steamID = this.extractSteamID(row);
      const nameEl = this.extractNameElement(row);
      if(!nameEl) return false;
      
      // Enhanced: Better cache checking with element validation
      if(steamID && this.processedSteamIDs.has(steamID)){
        const cached = this.cblCache.get(steamID);
        if(cached){
          // Check if element needs re-styling
          const needsRestyling = !this.coloredElements.has(nameEl) || 
                                !nameEl.classList.contains('cbl-player-name');
          
          if (needsRestyling) {
            this.applyPlayerNameColor(nameEl, cached);
            // Update element cache
            this.elementCache.set(steamID, {
              element: nameEl,
              timestamp: Date.now(),
              data: cached
            });
          }
          
          // Always ensure admin badge is present
          AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
          this.coloredElements.add(nameEl);
          return true;
        }
      }
      
      // Skip if already properly colored
      if(this.coloredElements.has(nameEl) && nameEl.classList.contains('cbl-player-name')) {
        // Ensure admin badge shows if present
        AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
        return false;
      }

      // CBL first (may color differently)
      if(steamID){
        let cblData = this.cblCache.get(steamID);
        if(!cblData){
          cblData = await this.fetchCBLData(steamID);
          this.cblCache.set(steamID, cblData);
        }
        this.applyPlayerNameColor(nameEl, cblData);
        
        // NEW: Enhanced element caching
        this.elementCache.set(steamID, {
          element: nameEl,
          timestamp: Date.now(),
          data: cblData
        });
        
        this.processedSteamIDs.add(steamID);
      }

      // Admin badge decoration with caching
      AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);

      this.coloredElements.add(nameEl);
      return true;
    }catch(e){ console.warn("CBL row process error:", e); return false; }
  },

  extractSteamID(row){
    const methods=[
      ()=>{ const s=row.querySelector('span.css-q3yk9k,.css-q3yk9k'); const m=s?.textContent?.match(/(765\d{14,})/); return m?.[1]||null; },
      ()=>{ const t=row.querySelector('[title*="765"]'); const m=t?.title?.match(/(765\d{14,})/); return m?.[1]||null; },
      ()=>{ const spans=row.querySelectorAll('span'); for(const sp of spans){ const m=sp.textContent.match(/(765\d{14,})/); if(m) return m[1]; } return null; },
      ()=>{ const m=(row.textContent||'').match(/(765\d{14,})/); return m?.[1]||null; },
      ()=>{ const a=row.getAttribute('data-steamid')||row.querySelector('[data-steamid]')?.getAttribute('data-steamid'); return a&&/765\d{14,}/.test(a)?a:null; }
    ];
    for(const fn of methods){ try{ const id=fn(); if(id&&id.length>=17){ return id; } }catch{} }
    return null;
  },

  extractNameElement(row){
    const cands=[
      ...row.querySelectorAll('[role="gridcell"]:first-child a[href*="/players/"]'),
      ...row.querySelectorAll('a[href*="/rcon/players/"]'),
      ...row.querySelectorAll('a[href*="/players/"]'),
      ...row.querySelectorAll('.css-1ewh5td'),
      ...row.querySelectorAll('[data-testid="player-name"]')
    ];
    const bad=txt=>{
      const t=(txt||'').trim().toLowerCase();
      return !t||t.length<2||/^\d+$/.test(t)||t.includes('view more information')||['view','edit','admin','moderator'].includes(t)||/^765\d+$/.test(t);
    };
    for(const el of cands){ const tx=el.textContent||''; if(!bad(tx)) return el; }

    const first=row.querySelector('[role="gridcell"]:first-child')||row.querySelector('td:first-child');
    if(first){
      let span=first.querySelector('.cbl-name-span');
      if(!span){ span=document.createElement('span'); span.className='cbl-name-span'; span.textContent=(first.textContent||'').trim(); first.innerHTML=''; first.appendChild(span); }
      return span;
    }
    return null;
  },

  async fetchCBLData(steamID){
    try{
      const res=await CBLManager.makeGraphQLRequest(steamID);
      const parsed=CBLManager.parseResponse(res);

      return parsed;
    }catch(e){
      
      return {riskRating:0,activeBans:0,expiredBans:0};
    }
  },

  applyPlayerNameColor(nameEl,cbl){
    const {riskRating,activeBans,expiredBans}=cbl;
    let color=COLORS.cblClean, bg='transparent', classes=[];
    const n=Number(riskRating);

    if(activeBans>0){ color=COLORS.cblActiveBan; bg='rgba(255,51,51,.1)'; classes.push('cbl-active-ban'); }
    else if(Number.isFinite(n)&&n>0){
      if(n>=8){ color=COLORS.cblVeryHighRisk; bg='rgba(255,102,102,.1)'; classes.push('cbl-risk-high'); }
      else if(n>=6){ color=COLORS.cblHighRisk; bg='rgba(255,153,51,.1)'; classes.push('cbl-risk-medium'); }
      else if(n>=3){ color=COLORS.cblMediumRisk; bg='rgba(255,170,0,.1)'; classes.push('cbl-risk-medium'); }
      else if(n>=1){ color=COLORS.cblLowRisk; bg='rgba(255,221,0,.1)'; }
    }

    const imp=(el,p,v)=>el.style.setProperty(p,v,'important');
    imp(nameEl,'color',color);
    if(bg!=='transparent') imp(nameEl,'background-color',bg);
    imp(nameEl,'padding','2px 4px');
    imp(nameEl,'border-radius','3px');
    imp(nameEl,'transition','all .3s ease');
    if(activeBans>0) imp(nameEl,'font-weight','700');

    nameEl.classList.add('cbl-player-name'); classes.forEach(c=>nameEl.classList.add(c));

    if(Number(riskRating)>0||activeBans>0||expiredBans>0){
      nameEl.title=`CBL Rating: ${riskRating}\nActive Bans: ${activeBans}\nExpired Bans: ${expiredBans}`;
      if(activeBans>0){
        nameEl.querySelector('.cbl-ban-indicator')?.remove();
        const s=document.createElement('span'); s.className='cbl-ban-indicator'; s.innerHTML=' ⚠️'; s.title=`${activeBans} active ban(s)`; nameEl.appendChild(s);
      }
      if(n>=6||activeBans>0) imp(nameEl,'text-shadow',`0 0 3px ${color}`);
    }else{
      nameEl.title='CBL: Clean (No history found)';
    }
          if(!nameEl.dataset.cblLogged){ nameEl.dataset.cblLogged="1"; }
  },

  softReset(){
    this.isProcessing = false;
    this.lastProcessTime = 0;
    // Enhanced: Preserve more cache data for better performance
    if(this.listObserver){
      this.listObserver.disconnect();
      this.listObserver = null;
    }
    if(this.scrollObserver){
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }

  },

  reset(){
    this.processedPlayers.clear();
    this.isProcessing = false;
    this.lastProcessTime = 0;
    this.coloredElements = new WeakSet();
    this.processedSteamIDs.clear();
    this.cblCache.clear();
    this.elementCache.clear(); // NEW: Clear element cache
    this.cacheWarmed = false; // NEW: Reset cache warming flag
    
    // Clear admin cache on reset
    AdminBadgeDecorator.clearCache();
    
    if(this.listObserver){
      this.listObserver.disconnect();
      this.listObserver = null;
    }
    if(this.scrollObserver){
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }

  },

  // NEW: Enhanced cache management methods
  cleanupOldCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [steamID, cacheEntry] of this.elementCache.entries()) {
      if (now - cacheEntry.timestamp > maxAge) {
        this.elementCache.delete(steamID);
      }
    }
    
    // Clean up old CBL cache entries using config
    const cblMaxAge = CONFIG.cacheConfig.cacheExpiry;
    for (const [steamID, data] of this.cblCache.entries()) {
      if (data.timestamp && (now - data.timestamp > cblMaxAge)) {
        this.cblCache.delete(steamID);
      }
    }
    
    // NEW: Save cache to persistent storage after cleanup
    if (CONFIG.cacheConfig.persistentStorage) {
      PersistentStorage.saveCache();
    }
  },

  // NEW: Force refresh all visible elements
  forceRefreshAll() {
    try {
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let refreshed = 0;
      
      rows.forEach(row => {
        const steamID = this.extractSteamID(row);
        const nameEl = this.extractNameElement(row);
        
        if (!nameEl || !steamID) return;
        
        const cached = this.cblCache.get(steamID);
        if (cached) {
          this.applyPlayerNameColor(nameEl, cached);
          AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
          refreshed++;
        }
      });
      

    } catch (e) {
      console.warn('CBL force refresh error:', e);
    }
  },

  // NEW: Smart cache warming - immediately apply cached data without API calls
  warmCacheFromStorage() {
    if (!CONFIG.cacheConfig.persistentStorage) return;
    
    try {
      // Load cache from persistent storage
      const restored = PersistentStorage.loadCache();
      if (!restored) return;
      
  
      
      // Immediately apply cached styling to visible elements
      const rows = document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let applied = 0;
      
      rows.forEach(row => {
        const steamID = this.extractSteamID(row);
        const nameEl = this.extractNameElement(row);
        
        if (!nameEl || !steamID) return;
        
        // Apply CBL styling from cache
        const cached = this.cblCache.get(steamID);
        if (cached) {
          this.applyPlayerNameColor(nameEl, cached);
          this.coloredElements.add(nameEl);
          applied++;
        }
        
        // Apply admin styling from cache
        AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
      });
      

      
      // Mark as processed to prevent unnecessary re-processing
      this.lastProcessTime = Date.now();
      
    } catch (e) {
      console.warn('Cache warming error:', e);
    }
  },

  // NEW: Aggressive caching - cache more data to reduce API calls
  enableAggressiveCaching() {
    if (!CONFIG.cacheConfig.aggressiveCaching) return;
    
    // Increase cache sizes and reduce expiry times
    this.cacheExpiryMultiplier = 2; // Cache data for 2x longer
    this.preloadThreshold = CONFIG.cacheConfig.preloadThreshold;
    

  }
};

// ========================================
// LOG PROCESSOR (no admin-name matching; keeps action highlighting)
// ========================================
const LogProcessor = {
  applyTimeStamps(){
    Utils.safeQuery(SELECTORS.timeStamp,els=>{
      els.forEach(el=>{
        const utc=el.getAttribute("datetime");
        if(utc){ const d=new Date(utc); if(!isNaN(d.getTime())) el.setAttribute("title", d.toLocaleString(undefined,{timeZoneName:"short"})); }
      });
    });
  },
  applyLogColoring(){
    const map=[
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.automatedMessages,color:COLORS.automatedMessage},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.adminWarningMessages,color:COLORS.automatedMessage},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.adminTerms,color:COLORS.adminAction},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.grayedOut,color:COLORS.grayed},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.joinedServer,color:COLORS.joined},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.leftServer,color:COLORS.leftServer},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.actionList,color:COLORS.modAction},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.teamBluefor,color:COLORS.teamBluefor},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.teamOpfor,color:COLORS.teamOpfor},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.teamIndependent,color:COLORS.teamIndependent},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.teamKilled,color:COLORS.teamKilled},
      {selector:SELECTORS.messageLog,patterns:TEXT_PATTERNS.trackedTriggers,color:COLORS.tracked},
    ];
    map.forEach(({selector,patterns,color})=>this.applyColorToElements(selector,patterns,color));
    Utils.safeQuery(SELECTORS.bmNoteFlag,els=>els.forEach(el=>{ el.style.color=COLORS.noteColorIcon; }));
  },
  applyColorToElements(selector,patterns,color){
    Utils.safeQuery(selector,els=>{
      els.forEach(el=>{
        // Skip if element already has a color set (respects CBL/admin coloring)
        if(el.style.color && el.style.color!=='') return;
        // Skip if element has CBL or admin classes
        if(el.classList.contains('cbl-player-name') || el.classList.contains('dmh-admin-name')) return;
        
        for(const phrase of patterns){ 
          if(el.textContent.includes(phrase)){ 
            el.style.color=color; 
            if(color===COLORS.automatedMessage) el.style.opacity="0.6"; 
            break; 
          } 
        }
      });
    });
  }
};

// ========================================
// DIALOG STYLER
// ========================================
const DialogStyler = {
  styleDialogs(){
    const cfg={ modalTitles:[
      {phrase:"Change Layer",styles:{color:"red",fontWeight:"bold",fontSize:"200pt"}},
      {phrase:"Set Next Layer",styles:{color:"lime",fontWeight:"bold",fontSize:"24pt"}},
      {phrase:"Kick",styles:{color:"orange",fontWeight:"bold",fontSize:"48pt"}},
      {phrase:"Warn",styles:{color:"lime",fontWeight:"bold",fontSize:"24pt"}},
    ]};
    setTimeout(()=>{
      this.applyStylesToElements(".modal-title",cfg.modalTitles);
      const playerMenu=[".css-f5o5h6 a",".css-f5o5h6 button",".css-1ixz43s a",".css-1ixz43s button"];
      const serverCmds=[".css-yun63y a",".css-yun63y button"];
      playerMenu.forEach(s=>this.applyPlayerMenuStyles(s));
      serverCmds.forEach(s=>this.applyServerCommandStyles(s));
    },500);
  },
  applyStylesToElements(selector,configs){ if(!configs) return; Utils.safeQuery(selector,els=>{ els.forEach(el=>{ configs.forEach(({phrase,styles})=>{ if(el.textContent.includes(phrase)) Object.assign(el.style,styles); }); }); }); },
  applyPlayerMenuStyles(selector){
    const styles=[
      {phrase:"Warn",styles:{color:"lime"}},{phrase:"Squad List",styles:{color:"gold"}},
      {phrase:"Kick",styles:{color:"orange"}},{phrase:"Ban",styles:{color:"red"}},
      {phrase:"Force Team Change",styles:{color:"#db4dff"}},{phrase:"Remove Player from Squad",styles:{color:"#804d00"}},
      {phrase:"Action - Reset Squad Name",styles:{color:"gold"}}
    ]; this.applyStylesToElements(selector,styles);
  },
  applyServerCommandStyles(selector){
    const styles=[
      {phrase:"Next Layer",styles:{color:"lime",fontSize:"16pt"}},
      {phrase:"Change Layer",styles:{color:"red",fontWeight:"bold",fontSize:"8pt"}},
      {phrase:"Squad List",styles:{color:"gold",fontSize:"16pt"}}
    ]; this.applyStylesToElements(selector,styles);
  }
};

// ========================================
// ROUTER WATCH (Enhanced with scroll handling)
// ========================================
const RouterWatch = {
  lastURL: location.href,
  scrollHandlers: new Set(),
  
  init() {
    const _ps = history.pushState;
    history.pushState = function() {
      const r = _ps.apply(this, arguments);
      dispatchEvent(new Event('locationchange'));
      return r;
    };
    const _rs = history.replaceState;
    history.replaceState = function() {
      const r = _rs.apply(this, arguments);
      dispatchEvent(new Event('locationchange'));
      return r;
    };

    addEventListener('popstate', this.onChange.bind(this));
    addEventListener('hashchange', this.onChange.bind(this));
    addEventListener('locationchange', this.onChange.bind(this));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        CBLPlayerListManager.fastRescan();
      }
    });
    window.addEventListener('focus', () => {
      CBLPlayerListManager.fastRescan();
    });
    
    // NEW: Enhanced scroll event handling
    this.setupGlobalScrollHandling();
  },
  
  onChange() {
    if (this.lastURL !== location.href) {
      const oldURL = this.lastURL;
      this.lastURL = location.href;
      
      // NEW: Enhanced navigation handling
      if (MainUpdater.isOnServerRCONPage()) {
        // Returning to RCON page - warm cache immediately
        if (oldURL && oldURL.includes('/rcon/players/')) {
      
          
          // Small delay to ensure DOM is ready, then warm cache
          setTimeout(() => {
            CBLPlayerListManager.observePlayerListContainer();
            CBLPlayerListManager.warmCacheFromStorage();
          }, 100);
        } else {
          // Normal RCON page load
          CBLPlayerListManager.observePlayerListContainer();
          CBLPlayerListManager.fastRescan();
        }
      } else if (oldURL && oldURL.includes('/rcon/servers/') && location.href.includes('/rcon/players/')) {
        // Navigating to player page - save cache before leaving
    
        if (CONFIG.cacheConfig.persistentStorage) {
          PersistentStorage.saveCache();
        }
      }
    }
  },
  
  // NEW: Setup global scroll handling for better cache management
  setupGlobalScrollHandling() {
    // Listen for scroll events on the document and window
    const scrollHandler = () => {
      // Debounced scroll handling
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        if (MainUpdater.isOnServerRCONPage()) {
          CBLPlayerListManager.handleScrollEvent();
        }
      }, 100);
    };
    
    this.scrollHandlers.add(scrollHandler);
    
    // Add scroll listeners to common scrollable containers
    document.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Also listen for wheel events (for mouse wheel scrolling)
    document.addEventListener('wheel', scrollHandler, { passive: true });
    

  },
  
  // NEW: Cleanup scroll handlers
  cleanup() {
    this.scrollHandlers.forEach(handler => {
      document.removeEventListener('scroll', handler);
      window.removeEventListener('scroll', handler);
      document.removeEventListener('wheel', handler);
    });
    this.scrollHandlers.clear();
  }
};

// ========================================
// MAIN UPDATE LOOP (Enhanced with cache management)
// ========================================
const MainUpdater = {
  lastPlayerKey: null,
  lastCacheCleanup: 0,
  cacheCleanupInterval: 2 * 60 * 1000, // 2 minutes
  
  async update(){
    if(!this.isLogContainerPresent()) return;
    
    // Enhanced: Periodic cache cleanup
    this.maybeCleanupCache();
    
    LogProcessor.applyTimeStamps();
    this.handlePlayerInterface();
    DialogStyler.styleDialogs();
    await this.handleCBLPlayerList();
    LogProcessor.applyLogColoring();
  },
  
  isLogContainerPresent(){ 
    return document.querySelector(SELECTORS.logContainer)||document.querySelector(SELECTORS.logContainerAlt); 
  },

  async handleCBLPlayerList(){
    if(this.isOnServerRCONPage()){
      CBLPlayerListManager.observePlayerListContainer();
      
      // NEW: Check if we should warm cache from storage first
      if (CONFIG.cacheConfig.persistentStorage && !CBLPlayerListManager.cacheWarmed) {
        CBLPlayerListManager.warmCacheFromStorage();
        CBLPlayerListManager.cacheWarmed = true;
      }
      
      await CBLPlayerListManager.processPlayerList();
    }else{
      if(CBLPlayerListManager.listObserver) {
        CBLPlayerListManager.softReset();
      }
    }
  },

  isOnServerRCONPage(){ 
    return /\/rcon\/servers\/\d+(?:\/.*)?$/.test(location.href); 
  },
  
  handlePlayerInterface(){
    const onPlayer = !!document.querySelector(SELECTORS.playerPage);
    if(onPlayer){
      Utils.ensureElement("copy-button",()=>UIComponents.createPlayerButtons());
      const m = location.href.match(/players\/(\d+)/); 
      const pid = m?m[1]:null; 
      const steamID = Utils.getTextByTitle("765","");
      const key = pid||steamID||null;
      if(key && key!==this.lastPlayerKey){ 
        this.lastPlayerKey = key; 
        Utils.removeElement("CBL-info"); 
        this.fetchCBLData(); 
      }
      else{ 
        Utils.ensureElement("CBL-info",()=>this.fetchCBLData()); 
      }
    }else{
      ["copy-button","open-url-button","CBL-info"].forEach(id=>Utils.removeElement(id)); 
      this.lastPlayerKey = null;
    }
  },
  
  async fetchCBLData(){ 
    const steamID = Utils.getTextByTitle("765","SteamID MISSING?"); 
    await CBLManager.fetchPlayerData(steamID); 
  },

  // NEW: Periodic cache cleanup to prevent memory leaks
  maybeCleanupCache() {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.cacheCleanupInterval) {
      this.lastCacheCleanup = now;
      
      try {
        CBLPlayerListManager.cleanupOldCache();
        AdminBadgeDecorator.cleanupCache();
    
      } catch (e) {
        console.warn('Cache cleanup error:', e);
      }
    }
  },

  // NEW: Force refresh all styling (useful for debugging)
  forceRefreshAll() {
    try {
      CBLPlayerListManager.forceRefreshAll();
      AdminBadgeDecorator.forceRefreshAll();
  
    } catch (e) {
      console.warn('Force refresh error:', e);
    }
  }
};

// ========================================
// CLOUDFLARE WORKER INTEGRATION MODULE (WebSocket + Snapshots)
// ========================================
const CloudflareIntegration = {
  // State management
  state: {
    lastUpdate: 0,
    isConnected: false,
    connectionStatus: 'disconnected',
    hasSnapshotData: false, // NEW: Track if we have HTTP snapshot data
    data: {
      adminActivity: null
    },
    alertHistory: [], // NEW: Store multiple admin commands
    audioEnabled: CONFIG.alertConfig.audioEnabled
  },

  // Initialize the integration
  init() {
    // Detect server ID first
    this.detectServerId();
    
    // Setup event listeners (but not overlay buttons yet)
    this.setupEventListeners();
    
    // Create overlay
    this.createOverlay();
    
    // Setup overlay button event listeners AFTER overlay is created
    this.setupOverlayButtons();
    
    // NEW: Setup audio system
    this.setupAudio();
    
    // NEW: Setup periodic alert cleanup (every 5 minutes)
    this.setupPeriodicCleanup();
    
    // Start with a delay to ensure page is ready
    setTimeout(async () => {
      // Show status while checking authentication
      this.setStatus("Checking authentication...");
      
      // Try to restore authentication first (including silent refresh)
      const isAuthenticated = await DMH_AUTH.ensureLogin();
      
      if (isAuthenticated) {
        // We have valid auth, start WebSocket connection
        this.setStatus("Connecting...");
        this.handleAuthSuccess();
        this.startWebSocketConnection();
      } else {
        // No valid auth found, show login required
        this.handleAuthFailure("Login required");
      }
    }, 2000);
  },

  // Auto-detect server ID from URL
  detectServerId() {
    // First, check if we have a manual override saved
    const savedServerId = localStorage.getItem('dmh-server-id-override');
    if (savedServerId) {
      CONFIG.cloudflare.serverId = savedServerId;
      return;
    }
    
    // Use bulletproof server ID detection
    const serverId = this.detectServerIdFromPage();
    if (serverId) {
      CONFIG.cloudflare.serverId = serverId;
    }
  },

  // Bulletproof server ID detection helper
  detectServerIdFromPage() {
    // URL like: https://www.battlemetrics.com/servers/squad/27157414
    const m = location.pathname.match(/\/servers\/(?:[a-z]+\/)?(\d{5,})/i);
    if (m) return m[1];

    // Sometimes BM pages stash it in data attributes
    const el = document.querySelector('[data-server-id]');
    if (el?.getAttribute('data-server-id')) return el.getAttribute('data-server-id');

    // Fallback: look for a link to the server page
    const link = document.querySelector('a[href*="/servers/"]');
    const m2 = link?.href?.match(/\/servers\/(?:[a-z]+\/)?(\d{5,})/i);
    if (m2) return m2[1];

    return null;
  },

  // Setup event listeners for real-time updates
  setupEventListeners() {
    // Listen for visibility changes to reconnect if needed
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.connectionStatus !== 'connected') {
        this.forceUpdate(); // Restart connection if needed
      }
    });

    // Listen for page focus to refresh data
    window.addEventListener('focus', () => {
      if (this.state.connectionStatus !== 'connected') {
        this.forceUpdate();
      }
    });

    // Listen for OAuth completion messages
    window.addEventListener('message', (event) => {
      // Only accept messages from our worker
      if (event.origin !== 'https://squadjs-admin-monitor-worker.itsdast0m.workers.dev') return;
      
      if (event.data && event.data.type === 'dmh_auth') {
        console.log('[DMH] Received auth message:', event.data);
        
        // Store the session data in localStorage
        DMH_AUTH.storeTokens(
          event.data.token, 
          event.data.refreshToken || event.data.refresh_token, 
          event.data.expiresAt
        );
        
        console.log('[DMH] Logged in as:', event.data.user?.username);
        
        // Now that we're authenticated, try to connect
        this.handleAuthSuccess();
        this.startWebSocketConnection();
      }
    });
    
    // NEW: Setup periodic token refresh to prevent expiration
    this.setupPeriodicTokenRefresh();
    
    // NEW: Periodic authentication check
    this.setupPeriodicAuthCheck();
    
    // NEW: Check for stale connections and reconnect if needed
    this.setupStaleConnectionCheck();
  },

  // Setup overlay button functionality
  setupOverlayButtons() {
    const overlay = document.getElementById('dmh-cloudflare-overlay');
    if (!overlay) return;

    // Discord login button
    const discordLoginBtn = overlay.querySelector('#discord-login-btn');
    if (discordLoginBtn) {
      console.log('[DMH] Discord login button found, adding event listener');
      discordLoginBtn.addEventListener('click', async () => {
        console.log('[DMH] Discord login button clicked!');
        this.setStatus('Redirecting to Discord...');
        this.state.connectionStatus = 'connecting';
        DMH_AUTH.startLogin();
      });
    } else {
      console.log('[DMH] Discord login button NOT found!');
    }

    // Logout button
    const logoutBtn = overlay.querySelector('#logout-btn');
    if (logoutBtn) {
      console.log('[DMH] Logout button found, adding event listener');
      logoutBtn.addEventListener('click', async () => {
        console.log('[DMH] Logout button clicked!');
        await this.logout();
      });
    } else {
      console.log('[DMH] Logout button NOT found!');
    }

    // Debug button
    const debugBtn = overlay.querySelector('.debug-btn');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        this.showDebugInfo();
      });
    }

    // Credits button
    const creditsBtn = overlay.querySelector('.credits-btn');
    if (creditsBtn) {
      creditsBtn.addEventListener('click', () => {
        this.showCredits();
      });
    }

    // Audio toggle button (initialize and bind)
    const audioBtn = overlay.querySelector('#audio-toggle-btn');
    if (audioBtn) {
      // Initialize icon state on creation
      this.updateAudioButtonState();
      audioBtn.addEventListener('click', () => {
        this.toggleAudio();
        this.updateAudioButtonState();
      });
    }

    // Clear history button
    const clearHistoryBtn = overlay.querySelector('#clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.clearAlertHistory();
      });
    }

    // Alert dropdown arrow
    const alertDropdownArrow = overlay.querySelector('#alert-dropdown-arrow');
    if (alertDropdownArrow) {
      alertDropdownArrow.addEventListener('click', () => {
        this.toggleAlertHistory();
      });
    }

    // Quick link buttons
    const sopBtn = overlay.querySelector('#sop-btn');
    if (sopBtn) {
      sopBtn.addEventListener('click', () => {
        window.open("https://docs.google.com/document/d/e/2PACX-1vTETPd69RXThe_gTuukFXeeMVTOhMvyzGmyeuXFKkHYd_Cg4CTREEwP2K61u_sWOleMJrkMKwQbBnCB/pub", "_blank");
      });
    }

    const msgBtn = overlay.querySelector('#msg-btn');
    if (msgBtn) {
      msgBtn.addEventListener('click', () => {
        window.open("https://docs.google.com/spreadsheets/d/1hBLYNHUahW3UxxOUJTb1GnZwo3HpmBSFTC3-Nbz-RXk/edit?gid=1852943146#gid=1852943146", "_blank");
      });
    }

    const rulesBtn = overlay.querySelector('#rules-btn');
    if (rulesBtn) {
      rulesBtn.addEventListener('click', () => {
        window.open("https://docs.google.com/document/d/e/2PACX-1vQzcm1es81lsxBEnXmSPRlqSS8Wgm04rd0KTmeJn88CN3Lo8pg1sT2-C1WTEXDBJfiDmW7Y6sJwv-Vi/pub", "_blank");
      });
    }

    const versionBtn = overlay.querySelector('#version-btn');
    if (versionBtn) {
      versionBtn.addEventListener('click', () => {
        window.open("https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js", "_blank");
      });
    }
  },

  // Force immediate update (for manual refresh)
  async forceUpdate() {
    console.log('[DMH] Force update triggered');
    
    // Reset connection status
    this.handleAuthSuccess();
    this.setStatus('Reconnecting...');
    
    // Restart WebSocket connection to get fresh data
    this.startWebSocketConnection();
  },
  
  // NEW: Setup audio system
  setupAudio() {
    // Create audio context for admin alerts
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load audio settings from localStorage
    const savedAudioState = localStorage.getItem('dmh-audio-enabled');
    if (savedAudioState !== null) {
      this.state.audioEnabled = savedAudioState === 'true';
    }
    
    // Update audio button state
    this.updateAudioButtonState();
  },
  
  // NEW: Toggle audio on/off
  toggleAudio() {
    this.state.audioEnabled = !this.state.audioEnabled;
    localStorage.setItem('dmh-audio-enabled', this.state.audioEnabled.toString());
    this.updateAudioButtonState();
  },
  
  // NEW: Update audio button visual state
  updateAudioButtonState() {
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) {
      if (this.state.audioEnabled) {
        audioBtn.textContent = '🔊';
        audioBtn.classList.remove('audio-off');
        audioBtn.title = 'Disable Audio Alerts';
      } else {
        audioBtn.textContent = '🔇';
        audioBtn.classList.add('audio-off');
        audioBtn.title = 'Enable Audio Alerts';
      }
    }
  },
  
  // NEW: Play admin alert sound
  playAdminAlertSound() {
    if (!this.state.audioEnabled || !this.audioContext) return;
    
    try {
      // Create a simple alert sound (beep pattern)
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Set volume
      gainNode.gain.setValueAtTime(CONFIG.alertConfig.audioVolume, this.audioContext.currentTime);
      
      // Create alert pattern: high-low-high beep
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play admin alert sound:', error);
    }
  },





  // Create the overlay UI
  createOverlay() {
    // Remove existing overlay if present
    Utils.removeElement('dmh-cloudflare-overlay');
    
    const overlay = document.createElement('div');
    overlay.id = 'dmh-cloudflare-overlay';
    overlay.className = 'dmh-overlay';
    overlay.innerHTML = this.getOverlayHTML();
    
    document.body.appendChild(overlay);
    
    // Make it draggable
    this.makeOverlayDraggable(overlay);
    
    // Setup collapse functionality
    this.setupCollapseFunctionality(overlay);
    
    // Restore position
    this.restoreOverlayPosition(overlay);
  },

  // Get overlay HTML template
  getOverlayHTML() {
    return `
      <div class="overlay-header">
        <div class="overlay-title">
          <span class="title-icon">⚡</span>
          <span class="title-text">DMH Server Monitor</span>
        </div>
        <div class="overlay-controls">
          <button class="overlay-btn collapse-btn" title="Collapse/Expand">−</button>
        </div>
      </div>
      
      <div class="overlay-content">
        <div class="overlay-section admin-camera">
          <h4><span class="section-icon">📹</span>Admin Camera</h4>
          <div class="admin-list" id="admin-camera-list">
            <div class="admin-entry">
              <span class="admin-icon">🛡️</span>
              <span class="admin-name">No admins in camera</span>
            </div>
          </div>
        </div>
        
        <div class="overlay-section last-alert">
          <h4>
            <span class="section-icon">⚠️</span>Player Alerts
            <span class="dropdown-arrow" id="alert-dropdown-arrow" title="Toggle Alert History">▼</span>
          </h4>
          <div class="alert-entry" id="last-alert-entry">
            <div class="alert-header">
              <span class="alert-icon">👤</span>
              <span class="alert-player" id="alert-player">No alerts</span>
              <span class="alert-time" id="alert-time"></span>
            </div>
            <div class="alert-message" id="alert-message"></div>
          </div>
          <div class="alert-history" id="alert-history" style="display: none;">
            <div class="alert-history-header">
              <span class="history-title">Alert History</span>
              <span class="history-count" id="history-count"></span>
            </div>
            <div class="alert-history-items" id="alert-history-items">
              <!-- Alert history items will be populated here -->
            </div>
          </div>
        </div>
        
        <div class="overlay-section quick-links">
          <h4><span class="section-icon">🔗</span>Quick Links</h4>
          <div class="quick-links-grid">
            <button class="quick-link-btn sop-btn" id="sop-btn" title="Standard Operating Procedures">
              <span class="btn-icon">📋</span>
              <span class="btn-text">SOP</span>
            </button>
            <button class="quick-link-btn msg-btn" id="msg-btn" title="Message Spreadsheet">
              <span class="btn-icon">💬</span>
              <span class="btn-text">MSG</span>
            </button>
            <button class="quick-link-btn rules-btn" id="rules-btn" title="Server Rules">
              <span class="btn-icon">📖</span>
              <span class="btn-text">Rules</span>
            </button>
            <button class="quick-link-btn version-btn" id="version-btn" title="Script Version">
              <span class="version-icon">⚡</span>
              <span class="btn-text">3.7</span>
            </button>
          </div>
        </div>
        
        <div class="overlay-section api-status">
          <h4><span class="section-icon">📡</span>API Status</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value" id="connection-status">Connecting...</span>
            </div>

            <div class="info-item">
              <span class="info-label">Connection:</span>
              <span class="connection-value" id="polling-mode">WebSocket</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="overlay-footer">
        <button class="overlay-btn debug-btn" title="Debug Info">🐛</button>
        <button class="overlay-btn credits-btn" title="Credits">💝</button>
        <button class="overlay-btn audio-toggle-btn" title="Toggle Audio Alerts" id="audio-toggle-btn">🔊</button>
        <button class="overlay-btn clear-history-btn" title="Clear Alert History" id="clear-history-btn">🗑️</button>
        <button class="overlay-btn discord-login-btn" title="Login with Discord" id="discord-login-btn">🔐</button>
      </div>
    `;
  },

  // Make overlay draggable (simple and reliable optimization)
  makeOverlayDraggable(overlay) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let lastMoveTime = 0;
    const throttleMs = 8; // ~120fps throttling for ultra-smooth dragging

    const header = overlay.querySelector('.overlay-header');
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.overlay-controls')) return; // Don't drag when clicking controls
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(overlay.style.left) || 0;
      startTop = parseInt(overlay.style.top) || 0;
      
      // Performance optimization: disable transitions during drag
      overlay.style.transition = 'none';
      
      overlay.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      // Simple time-based throttling for smooth performance
      const now = Date.now();
      if (now - lastMoveTime < throttleMs) return;
      lastMoveTime = now;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Keep using left/top but with throttling for smoothness
      overlay.style.left = (startLeft + deltaX) + 'px';
      overlay.style.top = (startTop + deltaY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        overlay.style.cursor = 'grab';
        
        // Re-enable transitions after drag
        overlay.style.transition = '';
        
        // Save position to localStorage (only on mouseup, not during drag)
        this.saveOverlayPosition(overlay);
      }
    });
  },

  // Setup collapse functionality
     setupCollapseFunctionality(overlay) {
      const collapseBtn = overlay.querySelector('.collapse-btn');
      const debugBtn = overlay.querySelector('.debug-btn');
      const creditsBtn = overlay.querySelector('.credits-btn');
    const content = overlay.querySelector('.overlay-content');
    const footer = overlay.querySelector('.overlay-footer');
    
    let isCollapsed = false;
    
    // Collapse/Expand functionality
    collapseBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      
      if (isCollapsed) {
        content.style.display = 'none';
        footer.style.display = 'none';
        collapseBtn.textContent = '+';
        overlay.classList.add('collapsed');
      } else {
        content.style.display = 'block';
        footer.style.display = 'flex';
        collapseBtn.textContent = '−';
        overlay.classList.remove('collapsed');
      }
      
      // Save collapsed state
      localStorage.setItem('dmh-overlay-collapsed', isCollapsed);
    });
    

    
         // Debug button functionality
     debugBtn.addEventListener('click', () => {
       this.showDebugInfo();
     });
     
     // Credits button functionality
     creditsBtn.addEventListener('click', () => {
       this.showCredits();
     });
     
         // Audio toggle button is handled in setupOverlayButtons - no duplicate binding here
     

    
    // Restore collapsed state
    const wasCollapsed = localStorage.getItem('dmh-overlay-collapsed') === 'true';
          if (wasCollapsed) {
        collapseBtn.click(); // Trigger collapse
      }
    },
  
     // Show debug information
   showDebugInfo() {
     const debugInfo = `
       <div style="background: rgba(0,0,0,0.9); padding: 20px; border-radius: 8px; border: 1px solid #00fff7;">
         <h3 style="color: #00fff7; margin: 0 0 15px 0;">DMH Overlay Debug Info</h3>
         <div style="margin-bottom: 10px; color: white;">
           <strong>Current URL:</strong> ${location.href}<br>
           <strong>Detected Server ID:</strong> ${CONFIG.cloudflare.serverId || 'None'}<br>
           <strong>Worker URL:</strong> ${CONFIG.cloudflare.workerBaseUrl}<br>
           <strong>Connection Status:</strong> ${this.state.connectionStatus}<br>
           <strong>Last Update:</strong> ${this.state.lastUpdate ? new Date(this.state.lastUpdate).toLocaleTimeString() : 'Never'}<br>
           <strong>Admin Activity:</strong> ${this.state.data.adminActivity ? 'Available' : 'None'}<br>
           <strong>WebSocket:</strong> ${this.state.isConnected ? 'Connected' : 'Disconnected'}
         </div>
         <div style="margin-bottom: 15px;">
           <button id="close-debug" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
         </div>
       </div>
     `;
     
     // Remove existing debug dialog
     Utils.removeElement('dmh-debug-dialog');
     
     const dialog = document.createElement('div');
     dialog.id = 'dmh-debug-dialog';
     dialog.style.cssText = `
       position: fixed;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       z-index: 100001;
       background: rgba(0,0,0,0.95);
       padding: 20px;
       border-radius: 12px;
       border: 1px solid #00fff7;
       box-shadow: 0 8px 32px rgba(0,0,0,0.5);
     `;
     dialog.innerHTML = debugInfo;
     
     document.body.appendChild(dialog);
     
     // Add event listener
     document.getElementById('close-debug').addEventListener('click', () => {
       Utils.removeElement('dmh-debug-dialog');
     });
   },
   
   // Show credits dialog
   showCredits() {
     const creditsInfo = `
       <div style="background: rgba(0,0,0,0.9); padding: 20px; border-radius: 8px; border: 1px solid #00fff7;">
         <h3 style="color: #00fff7; margin: 0 0 15px 0;">DMH Overlay - Credits and Mentions <3</h3>
         <div style="margin-bottom: 10px; color: white; line-height: 1.6;">
           <div style="margin-bottom: 15px;">
             <strong style="color: #ffaa00;">Developed by ♚Q♦G♛ DasT0m!</strong>
           </div>
           <div style="margin-bottom: 15px;">
             <strong>With help from:</strong><br>
             ♚Q♦G♛ ArmyRat60<br>
             ♚Q♦G♛ Edwin<br>
             『DMH』Relish
           </div>
           <div style="margin-bottom: 15px; text-align: center;">
             <strong style="color: #ff69b4; font-size: 16px;">Love you DMH Community <3</strong>
           </div>
         </div>
         <div style="margin-bottom: 15px;">
           <button id="close-credits" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
         </div>
       </div>
     `;
     
     // Remove existing credits dialog
     Utils.removeElement('dmh-credits-dialog');
     
     const dialog = document.createElement('div');
     dialog.id = 'dmh-credits-dialog';
     dialog.style.cssText = `
       position: fixed;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       z-index: 100001;
       background: rgba(0,0,0,0.95);
       padding: 20px;
       border-radius: 12px;
       border: 1px solid #00fff7;
       box-shadow: 0 8px 32px rgba(0,0,0,0.5);
     `;
     dialog.innerHTML = creditsInfo;
     
     document.body.appendChild(dialog);
     
     // Add event listener
     document.getElementById('close-credits').addEventListener('click', () => {
       Utils.removeElement('dmh-credits-dialog');
     });
   },
   


  // Save overlay position
  saveOverlayPosition(overlay) {
    const position = {
      left: overlay.style.left,
      top: overlay.style.top,
      timestamp: Date.now()
    };
    localStorage.setItem('dmh-overlay-position', JSON.stringify(position));
  },

  // Restore overlay position (with safety bounds)
  restoreOverlayPosition(overlay) {
    try {
      const saved = localStorage.getItem('dmh-overlay-position');
      if (saved) {
        const position = JSON.parse(saved);
        
        // Parse saved positions safely
        let left = parseInt(position.left) || 20;
        let top = parseInt(position.top) || 20;
        
        // Safety bounds: ensure overlay is visible on screen
        const maxLeft = Math.max(0, window.innerWidth - 400); // 400px = overlay width
        const maxTop = Math.max(0, window.innerHeight - 300);  // 300px = approximate overlay height
        
        left = Math.max(0, Math.min(left, maxLeft));
        top = Math.max(0, Math.min(top, maxTop));
        
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        

      } else {
        overlay.style.left = '20px';
        overlay.style.top = '20px';
      }
    } catch (e) {
      console.warn('Error restoring overlay position, using defaults:', e);
      overlay.style.left = '20px';
      overlay.style.top = '20px';
    }
  },

  // Update overlay with current data
  updateOverlay() {
    const overlay = document.getElementById('dmh-cloudflare-overlay');
    if (!overlay) {
      return;
    }

    // Update admin camera section
    if (this.state.data.adminActivity) {
      const admin = this.state.data.adminActivity;
      
      const adminList = document.getElementById('admin-camera-list');
      if (adminList) {
        if (admin.adminsInCamera && admin.adminsInCamera.length > 0) {
          // Time-bound filtering for disconnected admins (2 minute grace period)
          const now = Date.now();
          const activeAdmins = admin.adminsInCamera.filter(a => {
            if (!a.disconnected) return true;
            // if they were marked disconnected but it's old, show them as active again
            const dt = a.disconnectTime ? (now - a.disconnectTime) : 0;
            return dt > 120000; // 2 minutes "grace"
          });
          if (activeAdmins.length > 0) {
            adminList.innerHTML = activeAdmins.map(admin => `
              <div class="admin-entry">
                <span class="admin-icon">🛡️</span>
                <span class="admin-name">${admin.name || 'Unknown'}</span>
              </div>
            `).join('');
          } else {
            adminList.innerHTML = `
              <div class="overlay-section admin-camera">
                <span class="admin-icon">🛡️</span>
                <span class="admin-name">No admins in camera</span>
              </div>
            `;
          }
        } else {
          adminList.innerHTML = `
            <div class="admin-entry">
              <span class="admin-icon">🛡️</span>
              <span class="admin-name">No admins in camera</span>
            </div>
          `;
        }
      }
    }

    // Update last alert section
    if (this.state.data.adminActivity?.lastAdminCommand) {
      const command = this.state.data.adminActivity.lastAdminCommand;
      const timeAgo = this.getTimeAgo(command.timestamp);
      
      // Check if this is a new alert (not already in history)
      const isNewAlert = !this.state.alertHistory.some(alert => 
        alert.timestamp === command.timestamp && 
        alert.admin?.eosID === command.admin?.eosID
      );
      
      if (isNewAlert) {
        // Add to alert history
        this.addToAlertHistory(command);
        
        // Play sound and flash for new alerts
        this.playAdminAlertSound();
        this.flashAlertSection();
      }
      
      this.updateElement('alert-player', command.admin?.name || 'Unknown');
      this.updateElement('alert-time', timeAgo);
      
      // Show the alert message if available
      const alertMessage = document.getElementById('alert-message');
      if (alertMessage && command.message) {
        alertMessage.textContent = `"${command.message}"`;
        alertMessage.style.display = 'block';
      } else if (alertMessage) {
        alertMessage.style.display = 'none';
      }
      
      // Update alert history display
      this.updateAlertHistoryDisplay();
    } else {
      this.updateElement('alert-player', 'No alerts');
      this.updateElement('alert-time', '');
      const alertMessage = document.getElementById('alert-message');
      if (alertMessage) alertMessage.style.display = 'none';
      
      // Hide alert history if no alerts
      const alertHistory = document.getElementById('alert-history');
      if (alertHistory) alertHistory.style.display = 'none';
    }



    // Update API status section - don't overwrite the display text set by setStatus
    // this.updateElement('connection-status', this.state.connectionStatus);
    
    // Update connection mode indicator
    const connectionMode = this.getConnectionModeDisplay();
    this.updateElement('polling-mode', connectionMode);
    
    // Apply connection mode styling
    const connectionModeElement = document.getElementById('polling-mode');
    if (connectionModeElement) {
      connectionModeElement.className = 'connection-value';
      if (this.state.connectionStatus === 'connected') {
        connectionModeElement.classList.add('websocket-connected');
      } else if (this.state.connectionStatus === 'error') {
        connectionModeElement.classList.add('websocket-error');
      } else {
        connectionModeElement.classList.add('websocket-connecting');
      }
    }

    // Update visual indicators
    this.updateConnectionIndicator();
    

  },

  // Update a specific element
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  },

  // Set connection status
  setStatus(status) {
    this.state.connectionStatus = status;
    
    // Map status to display text
    let displayText = status;
    if (status === 'connected') {
      displayText = 'Connected';
    } else if (status === 'connecting') {
      displayText = 'Connecting...';
    } else if (status === 'error') {
      displayText = 'Connection Error';
    } else if (status === 'auth_failed') {
      displayText = 'Login Required';
    } else if (status === 'stale') {
      displayText = 'Stale Connection';
    } else if (status === 'disconnected') {
      displayText = 'Disconnected';
    } else if (status === 'Login required') {
      displayText = 'Login Required';
    } else if (status === 'Authentication expired, please login again') {
      displayText = 'Session Expired';
    } else if (status === 'Logged out') {
      displayText = 'Logged Out';
    }
    
    this.updateElement('connection-status', displayText);
    this.updateConnectionIndicator();
  },

  // Get time ago string
  getTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },
  
  // NEW: Add command to alert history
  addToAlertHistory(command) {
    // Add to beginning of array (most recent first)
    this.state.alertHistory.unshift({
      ...command,
      id: Date.now() + Math.random(), // Unique ID for each alert
      addedAt: Date.now() // Track when this alert was added
    });
    
    // Keep only the most recent alerts
    if (this.state.alertHistory.length > CONFIG.alertConfig.maxAlertHistory) {
      this.state.alertHistory = this.state.alertHistory.slice(0, CONFIG.alertConfig.maxAlertHistory);
    }
    

  },
  
  // NEW: Update alert history display
  updateAlertHistoryDisplay() {
    const alertHistory = document.getElementById('alert-history');
    const alertHistoryItems = document.getElementById('alert-history-items');
    const historyCount = document.getElementById('history-count');
    const dropdownArrow = document.getElementById('alert-dropdown-arrow');
    
    if (!alertHistory || !alertHistoryItems || !historyCount || !dropdownArrow) return;
    
    // Clean up expired alerts first (20 minutes)
    this.cleanupExpiredAlerts();
    
    if (this.state.alertHistory.length === 0) {
      alertHistory.style.display = 'none';
      dropdownArrow.style.display = 'none';
      return;
    }
    
    // Show dropdown arrow if there are alerts
    dropdownArrow.style.display = 'inline-block';
    
    // Update history count
    historyCount.textContent = `(${this.state.alertHistory.length})`;
    
    // Build history HTML (show all alerts in history)
    const historyItems = this.state.alertHistory.map(alert => `
      <div class="alert-history-item">
        <div class="alert-history-header">
          <span class="alert-history-player">${alert.admin?.name || 'Unknown'}</span>
          <span class="alert-history-time">${this.getTimeAgo(alert.timestamp)}</span>
        </div>
        <div class="alert-history-message">"${alert.message || 'No message'}"</div>
      </div>
    `).join('');
    
    alertHistoryItems.innerHTML = historyItems;
  },
  
  // NEW: Flash the alert section
  flashAlertSection() {
    const alertSection = document.querySelector('.last-alert');
    if (!alertSection) return;
    
    // Remove existing flash class
    alertSection.classList.remove('alert-flash');
    
    // Add flash class to trigger animation
    setTimeout(() => {
      alertSection.classList.add('alert-flash');
    }, 10);
    
    // Remove flash class after animation completes
    setTimeout(() => {
      alertSection.classList.remove('alert-flash');
    }, CONFIG.alertConfig.flashDuration);
  },
  
  // NEW: Clean up expired alerts (20 minutes)
  cleanupExpiredAlerts() {
    const now = Date.now();
    const expiryTime = 20 * 60 * 1000; // 20 minutes in milliseconds
    
    // Filter out expired alerts - ONLY use addedAt for expiration logic
    const beforeCleanup = this.state.alertHistory.length;
    this.state.alertHistory = this.state.alertHistory.filter(alert => {
      // Only use addedAt for expiration - this is when the alert was added to the overlay
      if (!alert.addedAt) {
        return false; // Remove alerts without addedAt (old alerts from before fix)
      }
      
      const timeSinceAdded = now - alert.addedAt;
      const isExpired = timeSinceAdded >= expiryTime;
      
      return !isExpired;
    });
    const afterCleanup = this.state.alertHistory.length;
    
    // Update the display after cleanup if any alerts were removed
    if (beforeCleanup > afterCleanup) {
      this.updateAlertHistoryDisplay();
    }
  },
  
  // NEW: Setup periodic cleanup every 5 minutes
  setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupExpiredAlerts();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Also run cleanup every minute for more responsive expiration
    setInterval(() => {
      this.cleanupExpiredAlerts();
    }, 60 * 1000); // Every minute
    

  },

  // NEW: Setup periodic token refresh to prevent expiration
  setupPeriodicTokenRefresh() {
    // Refresh token every 30 minutes (well before 2-hour expiration)
    setInterval(async () => {
      try {
        if (this.state.isConnected) {
          console.log('[DMH] Periodic token refresh check...');
          const ok = await DMH_AUTH.ensureLogin();
          if (!ok) {
            console.warn('[DMH] Periodic refresh failed, will retry on next connection attempt');
          } else {
            console.log('[DMH] Periodic token refresh successful');
          }
        }
      } catch (error) {
        console.error('[DMH] Periodic token refresh error:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes
  },

  // NEW: Setup periodic authentication check
  setupPeriodicAuthCheck() {
    // Check authentication status every 5 minutes
    setInterval(async () => {
      try {
        if (this.state.isConnected && this.state.connectionStatus === 'connected') {
          // Only check if we think we're connected
          const ok = await DMH_AUTH.ensureLogin();
          if (!ok) {
            console.log('[DMH] Periodic auth check failed, connection may be stale');
            // Don't immediately disconnect, but mark for reconnection on next operation
            this.state.connectionStatus = 'stale';
          }
        }
      } catch (error) {
        console.error('[DMH] Periodic auth check error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  },

  // NEW: Setup stale connection check and recovery
  setupStaleConnectionCheck() {
    // Check for stale connections every 2 minutes and reconnect if needed
    setInterval(async () => {
      try {
        if (this.state.connectionStatus === 'stale') {
          console.log('[DMH] Detected stale connection, attempting recovery...');
          this.state.connectionStatus = 'connecting';
          this.setStatus('Reconnecting stale connection...');
          this.startWebSocketConnection();
        }
      } catch (error) {
        console.error('[DMH] Stale connection recovery error:', error);
      }
    }, 2 * 60 * 1000); // 2 minutes
  },

  // NEW: Handle authentication success and reset connection status
  handleAuthSuccess() {
    this.state.connectionStatus = 'connecting';
    this.state.isConnected = false;
    this.setStatus('Authentication successful, connecting...');
    this.updateOverlay();
  },

  // NEW: Handle authentication failure and set appropriate status
  handleAuthFailure(reason = 'Authentication failed') {
    this.state.connectionStatus = 'auth_failed';
    this.state.isConnected = false;
    this.setStatus(reason);
    this.updateOverlay();
  },

  // NEW: Ensure authentication before API calls
  async ensureAuthBeforeCall() {
    // Check if we have valid authentication
    if (!DMH_AUTH.isValid()) {
      // Try to refresh the token
      const authOk = await DMH_AUTH.ensureLogin();
      if (!authOk) {
        throw new Error('Authentication required');
      }
    }
    
    // Return the bearer token for the API call
    return DMH_AUTH.bearer();
  },

  // NEW: Check if user is currently authenticated
  isAuthenticated() {
    return DMH_AUTH.isValid();
  },

  // NEW: Handle logout and clear stored tokens
  async logout() {
    // Clear tokens from server if we have a refresh token
    if (DMH_AUTH.refreshToken) {
      try {
        await fetch(`${DMH_AUTH.workerOrigin}/session/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refresh_token: DMH_AUTH.refreshToken
          })
        });
      } catch (error) {
        console.error('[DMH] Server logout failed:', error);
      }
    }
    
    // Clear local tokens
    DMH_AUTH.clearTokens();
    this.state.connectionStatus = 'auth_failed';
    this.state.isConnected = false;
    this.setStatus('Logged out');
    this.updateOverlay();
  },

  // Update connection indicator
  updateConnectionIndicator() {
    const overlay = document.getElementById('dmh-cloudflare-overlay');
    if (!overlay) return;

    overlay.className = `dmh-overlay connection-${this.state.connectionStatus}`;
    
    // Update status colors
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = `connection-value status-${this.state.connectionStatus}`;
    }
  },

  

  // Test basic connectivity to Cloudflare Worker
  async testConnectivity() {
    try {
  
      const response = await fetch(`${CONFIG.cloudflare.workerBaseUrl}/api/status`);
      if (response.ok) {

      } else {
        console.warn('⚠️ Basic connectivity test failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Basic connectivity test failed:', error.message);
    }
  },
   
   // Cleanup on unmount
   cleanup() {
     this.stopAllUpdates();
     Utils.removeElement('dmh-cloudflare-overlay');
 
   },

  // NEW: Start WebSocket connection for real-time updates (SECURE PROXY APPROACH)
  async startWebSocketConnection() {
    const serverId = CONFIG.cloudflare.serverId;
    if (!serverId) {
      this.setStatus("Open a BattleMetrics server page");
      console.warn("No server ID available for WebSocket connection");
      return; // don't call overview/ws-token without a server id
    }

    // === SECURE WS client for overlay ================================================
    const SERVER_ID = CONFIG.cloudflare.serverId;
    let ws, reconnectTimer, gotInitial = false;

    // Mint a single-use WS token (requires session auth)
    const getWebSocketToken = async () => {
      // Ensure we have (or refresh) a valid session
      const bearer = await this.ensureAuthBeforeCall();
      if (!bearer) {
        // Signal to caller that user action is required
        const err = new Error('LOGIN_REQUIRED');
        err.code = 'LOGIN_REQUIRED';
        throw err;
      }

      const tokenUrl = `${CONFIG.cloudflare.workerBaseUrl}${CONFIG.cloudflare.endpoints.wsToken}?server=${serverId}`;
      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Authorization": bearer }
      });
      if (!resp.ok) throw new Error(`WS token mint failed: ${resp.status}`);
      const { websocketUrl } = await resp.json();
      return websocketUrl;
    };

    // 1. optional 1.5s fallback: one-time GET if snapshot didn't arrive yet
    const initialFallback = setTimeout(async () => {
      if (!gotInitial) {
        try {
          // Ensure we have a valid session before fetching overview
          const bearer = await this.ensureAuthBeforeCall();
          if (!bearer) {
            console.warn('⚠️ Authentication failed for initial fallback - user needs to login');
            this.handleAuthFailure('Login required');
            return;
          }
          
          const ov = await fetch(`${CONFIG.cloudflare.workerBaseUrl}/api/overview?server=${serverId}`, {
            headers: { 
              "Authorization": bearer
            }
          }).then(r => {
            if (!r.ok) throw new Error(`Overview failed: ${r.status}`);
            return r.json();
          });
          if (ov && !ov.error) {
            gotInitial = true;
            this.handleSnapshotData(ov);
          }
        } catch (e) { 
          console.warn('⚠️ Initial fallback failed:', e); 
        }
      }
    }, 1500);

    const connectWS = async () => {
      try { ws?.close(); } catch {}
      
      try {
        // SECURITY: Get fresh WebSocket URL with session token
        const WS_URL = await getWebSocketToken();
        ws = new WebSocket(WS_URL);
      } catch (error) {
        if (error?.code === 'LOGIN_REQUIRED' || error?.message === 'LOGIN_REQUIRED') {
          this.handleAuthFailure('Login required');
          return; // do not auto-retry; wait for user to click login
        }
        console.error('❌ Failed to establish WebSocket connection:', error);
        this.state.connectionStatus = 'error';
        this.updateOverlay();
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        this.state.connectionStatus = 'connected';
        this.state.isConnected = true;
        this.state.retryCount = 0;
        this.setStatus('connected'); // This will be mapped to "Connected" by setStatus
        this.updateOverlay();
      };

      ws.onmessage = (e) => {
        if (e.data === "ping") { 
          try { ws.send("pong"); } catch {} 
          return; 
        }

        let msg;
        try { 
          msg = JSON.parse(e.data); 
        } catch { 
          console.warn('Failed to parse WebSocket message:', e.data);
          return; 
        }

        if (msg.type === "snapshot") {
          gotInitial = true; 
          clearTimeout(initialFallback);
          this.handleSnapshotData(msg.payload);
          return;
        }
        
        if (msg.type === "replay" && Array.isArray(msg.events)) {
          gotInitial = true; 
          clearTimeout(initialFallback);
          for (const ev of msg.events) {
            this.handleDeltaUpdate(ev);
          }
          return;
        }
        
        if (msg.type === "auth_error" || msg.type === "token_expired") {
          console.warn('[DMH] WebSocket authentication error, re-authenticating...');
          this.handleAuthFailure('Authentication expired, please login again');
          try { ws.close(); } catch {}
          return;
        }
        
        this.handleDeltaUpdate(msg);
      };

      ws.onclose = (event) => {
        console.log('[DMH] WebSocket closed:', event.code, event.reason);
        this.state.connectionStatus = 'disconnected';
        this.updateOverlay();
        
        // Don't auto-reconnect if it was an authentication failure
        if (event.code === 1008 || event.code === 1003) { // Policy violation or forbidden
          console.log('[DMH] WebSocket closed due to authentication/policy issue, not auto-reconnecting');
          this.handleAuthFailure('Authentication required');
          return;
        }
        
        scheduleReconnect();
      };
      
      ws.onerror = (error) => {
        console.warn('🔌 WebSocket error:', error);
        this.state.connectionStatus = 'error';
        this.updateOverlay();
        try { ws.close(); } catch {}
      };
    };

    const scheduleReconnect = () => {
      clearTimeout(reconnectTimer);
      this.state.retryCount++;
      const delay = Math.min(2000 * Math.pow(1.5, this.state.retryCount), 30000); // Max 30s

      // Don't auto-reconnect if we have authentication issues
      if (this.state.connectionStatus === 'auth_failed') {
        console.log('[DMH] Skipping auto-reconnect due to authentication failure');
        return;
      }

      reconnectTimer = setTimeout(() => connectWS(), delay);
    };

    // Store WebSocket reference for cleanup
    this.ws = ws;
    this.reconnectTimer = reconnectTimer;
    
    connectWS();
    // ========================================================================
  },

  // Handle snapshot data (initial load)
  handleSnapshotData(snapshot) {
    // Update our state with the snapshot
    if (snapshot.adminActivity) {
      this.state.data.adminActivity = snapshot.adminActivity;
      
      // NEW: Initialize alert history from snapshot if available
      if (snapshot.adminActivity.lastAdminCommand && this.state.alertHistory.length === 0) {
        this.addToAlertHistory(snapshot.adminActivity.lastAdminCommand);
      }
    }
    
    // Mark that we have snapshot data (but don't claim "connected" yet)
    this.state.hasSnapshotData = true;
    this.state.lastUpdate = Date.now();
    
    // Update the overlay
    this.updateOverlay();
  },

  // Handle delta updates (incremental changes)
  handleDeltaUpdate(delta) {
    // Apply delta based on kind
    switch (delta?.kind) {
      case "admin_activity":
        if (delta.payload) {
          this.state.data.adminActivity = { ...this.state.data.adminActivity, ...delta.payload };
          this.updateCameraDisplay(); // Fast update for admin camera
        }
        break;
        
      case "overview":
        if (delta.payload) {
          // Full overview update
          this.handleSnapshotData(delta.payload);
        }
        break;
    }
    
    // Update last update time
    this.state.lastUpdate = Date.now();
  },

  // Stop all update mechanisms
  stopAllUpdates() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    

  },

  // Update only camera display for instant updates
  updateCameraDisplay() {
    const cameraList = document.getElementById('admin-camera-list');
    if (!cameraList) return;
    
    const admins = this.state.data.adminActivity?.adminsInCamera || [];
    
    if (admins.length === 0) {
      cameraList.innerHTML = `
        <div class="admin-entry">
          <span class="admin-icon">🛡️</span>
          <span class="admin-name">No admins in camera</span>
        </div>
      `;
    } else {
      // Time-bound filtering for disconnected admins (2 minute grace period)
      const now = Date.now();
      const activeAdmins = admins.filter(a => {
        if (!a.disconnected) return true;
        // if they were marked disconnected but it's old, show them as active again
        const dt = a.disconnectTime ? (now - a.disconnectTime) : 0;
        return dt > 120000; // 2 minutes "grace"
      });
      
      if (activeAdmins.length > 0) {
        cameraList.innerHTML = activeAdmins.map(admin => `
          <div class="admin-entry">
            <span class="admin-icon">📹</span>
            <span class="admin-name">${admin.name || 'Unknown'}</span>
          </div>
        `).join('');
      } else {
        cameraList.innerHTML = `
          <div class="admin-entry">
            <span class="admin-icon">🛡️</span>
            <span class="admin-name">No admins in camera</span>
          </div>
        `;
      }
    }
  },

  // NEW: Get connection mode display text
  getConnectionModeDisplay() {
    switch (this.state.connectionStatus) {
      case 'connected':
        return 'WebSocket - Realtime';
      case 'connecting':
        return 'WebSocket - Connecting...';
      case 'error':
        return 'WebSocket - Error';
      case 'disconnected':
        if (this.state.hasSnapshotData) {
          return 'HTTP snapshot (not live)';
        }
        return 'WebSocket - Disconnected';
      case 'auth_failed':
        return 'Authentication Required';
      case 'stale':
        return 'WebSocket - Stale';
      default:
        return 'WebSocket - Connecting...';
    }
  },

  // Clear alert history
  clearAlertHistory() {
    this.state.alertHistory = [];
    this.updateAlertHistoryDisplay();
  },

  // NEW: Toggle alert history dropdown
  toggleAlertHistory() {
    const alertHistory = document.getElementById('alert-history');
    const dropdownArrow = document.getElementById('alert-dropdown-arrow');
    
    if (!alertHistory || !dropdownArrow) return;
    
    const isVisible = alertHistory.style.display !== 'none';
    
    if (isVisible) {
      // Hide history
      alertHistory.style.display = 'none';
      dropdownArrow.textContent = '▼';
      dropdownArrow.title = 'Show Alert History';
    } else {
      // Show history
      alertHistory.style.display = 'block';
      dropdownArrow.textContent = '▲';
      dropdownArrow.title = 'Hide Alert History';
    }
  }
};

// ========================================
// BOOTSTRAP (Enhanced with debugging and global utilities)
// ========================================
class BMOverlay {
  constructor(){ this.isInitialized=false; }
  
  async init(){
    if(this.isInitialized) return;

    StyleManager.init();
    RouterWatch.init();

    // NEW: Initialize Cloudflare integration
    CloudflareIntegration.init();

    this.startUpdateLoop();
    this.isInitialized=true;
    
    // NEW: Setup global debugging utilities
    this.setupGlobalUtilities();
  }
  
  startUpdateLoop(){
    setInterval(async()=>{ try{ await MainUpdater.update(); }catch(e){ console.error("Update loop error:",e); } }, CONFIG.updateRate);
  }
  
  observeDOM(){
    const obs=new MutationObserver(()=> {
      const ready=[".ReactVirtualized__Grid__innerScrollContainer",".navbar-brand"].some(sel=>document.querySelector(sel));
      if(ready){ obs.disconnect(); this.init(); }
    });
    obs.observe(document.body,{childList:true,subtree:true,attributes:true});
  }
  
  // NEW: Setup global utilities for debugging
  setupGlobalUtilities() {
    // Make debugging functions available globally
    window.DMH_DEBUG = {
      cacheStatus: () => Utils.debugCacheStatus(),
      forceRefresh: () => Utils.forceRefreshAllStyling(),
      clearCaches: () => Utils.clearAllCaches(),
      forceRefreshAll: () => MainUpdater.forceRefreshAll(),
      getCacheInfo: () => ({
        cblCache: CBLPlayerListManager.cblCache.size,
        adminCache: AdminBadgeDecorator.adminCache.size,
        elementCache: CBLPlayerListManager.elementCache.size,
        processedSteamIDs: CBLPlayerListManager.processedSteamIDs.size
      }),
      // NEW: Status UI testing functions
      testStatus: (status) => {
        if (CloudflareIntegration.instance) {
          CloudflareIntegration.instance.setStatus(status);
        }
      },
      getStatus: () => {
        if (CloudflareIntegration.instance) {
          return {
            connectionStatus: CloudflareIntegration.instance.state.connectionStatus,
            isConnected: CloudflareIntegration.instance.state.isConnected,
            isAuthenticated: CloudflareIntegration.instance.isAuthenticated()
          };
        }
        return null;
      },
      // NEW: Persistent storage utilities
      persistentStorage: {
        save: () => PersistentStorage.saveCache(),
        load: () => PersistentStorage.loadCache(),
        clear: () => PersistentStorage.clearStorage(),
        stats: () => PersistentStorage.getStats(),
        warm: () => CBLPlayerListManager.warmCacheFromStorage()
      },
      // NEW: Cache warming utilities
      warmCache: () => CBLPlayerListManager.warmCacheFromStorage(),
      enableAggressive: () => CBLPlayerListManager.enableAggressiveCaching(),
      // NEW: Cloudflare integration utilities
      cloudflare: {
        forceUpdate: () => CloudflareIntegration.forceUpdate(),
        getStatus: () => CloudflareIntegration.state,
        getData: () => CloudflareIntegration.state.data,
        reconnectWS: () => CloudflareIntegration.startWebSocketConnection(),
        // NEW: Debug alert history
        testAlertHistory: () => {
          const testCommand = {
            admin: { name: 'TestPlayer', eosID: 'test' + Date.now() },
            message: 'Test admin command ' + new Date().toLocaleTimeString(),
            timestamp: Date.now()
          };
          CloudflareIntegration.addToAlertHistory(testCommand);
          CloudflareIntegration.updateAlertHistoryDisplay();
  
        },
        showAlertHistory: () => {

          CloudflareIntegration.updateAlertHistoryDisplay();
        },
        forceCleanup: () => {

          CloudflareIntegration.cleanupExpiredAlerts();
        }
      }
    };
    


  }
}

const overlay = new BMOverlay();
overlay.observeDOM();
