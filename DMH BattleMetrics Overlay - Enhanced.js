// File: DMH Overlay Enhanced.js
// ==UserScript==
// @name DMH BattleMetrics Overlay - Enhanced
// @namespace https://www.battlemetrics.com/
// @version 3.45
// @updateURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js
// @downloadURL https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js
// @description Modifies the rcon panel for battlemetrics to help color code important events and details about players. Enhanced with CBL player list coloring & virtualization-safe styling, plus admin coloring.
// @author DasT0m, Relish, ArmyRat60, DMH Clan <3
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
  version: "3.5",
  updateRate: 150,

  // NEW: Enhanced caching configuration
  cacheConfig: {
    persistentStorage: true,        // Use localStorage for persistence
    cacheExpiry: 30 * 60 * 1000,   // 30 minutes for CBL data
    adminCacheExpiry: 10 * 60 * 1000, // 10 minutes for admin status
    maxCacheSize: 1000,             // Maximum cache entries
    preloadThreshold: 50,           // Preload when this many players are visible
    aggressiveCaching: true         // Cache more aggressively
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
    console.log('=== CACHE STATUS DEBUG ===');
    console.log(`CBL Cache: ${CBLPlayerListManager.cblCache.size} entries`);
    console.log(`Admin Cache: ${AdminBadgeDecorator.adminCache.size} entries`);
    console.log(`Element Cache: ${CBLPlayerListManager.elementCache.size} entries`);
    console.log(`Processed SteamIDs: ${CBLPlayerListManager.processedSteamIDs.size}`);
    console.log(`Colored Elements: ${CBLPlayerListManager.coloredElements.size || 'WeakSet (unknown size)'}`);
    console.log('========================');
  },

  // NEW: Force refresh all styling (global utility)
  forceRefreshAllStyling() {
    console.log('Forcing refresh of all styling...');
    MainUpdater.forceRefreshAll();
  },

  // NEW: Clear all caches (global utility)
  clearAllCaches() {
    console.log('Clearing all caches...');
    CBLPlayerListManager.reset();
    AdminBadgeDecorator.clearCache();
    console.log('All caches cleared');
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
      console.log(`Cache saved to localStorage: ${Object.keys(cacheData.cblData).length} CBL entries, ${Object.keys(cacheData.adminData).length} admin entries`);
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
        console.log('Cache version mismatch, clearing old cache');
        this.clearStorage();
        return false;
      }

      // Expiry check
      const now = Date.now();
      if (now - cacheData.timestamp > CONFIG.cacheConfig.cacheExpiry) {
        console.log('Cache expired, clearing old cache');
        this.clearStorage();
        return false;
      }

      // Server ID check (only restore if same server)
      if (cacheData.metadata?.serverId !== this.extractServerId()) {
        console.log('Different server, not restoring cache');
        return false;
      }

      // Restore caches
      this.deserializeCBLData(cacheData.cblData);
      this.deserializeAdminData(cacheData.adminData);

      console.log(`Cache restored from localStorage: ${Object.keys(cacheData.cblData).length} CBL entries, ${Object.keys(cacheData.adminData).length} admin entries`);
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
      console.log('LocalStorage cache cleared');
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
  },
  addCBLPlayerListStyles(){
    GM_addStyle(`
      tbody tr:hover{background-color:rgba(255,255,255,.05)!important;}
      .cbl-risk-high{box-shadow:0 0 5px rgba(255,51,51,.5)!important;}
      .cbl-risk-medium{box-shadow:0 0 3px rgba(255,153,51,.5)!important;}
      .cbl-active-ban{animation:pulseRed 2s infinite;}
      @keyframes pulseRed{
        0%{box-shadow:0 0 5px rgba(255,51,51,.3);}
        50%{box-shadow:0 0 15px rgba(255,51,51,.7);}
        100%{box-shadow:0 0 5px rgba(255,51,51,.3);}
      }
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
  createCornerButtons(){
    const wrap=Object.assign(document.createElement("div"),{className:"bm-button-container",style:"position:absolute;top:105px;right:1%;z-index:99999;display:flex;gap:8px;align-items:center;"});
    document.body.appendChild(wrap); this.addCornerButtonStyles();

    CONFIG.servers.forEach(s=>{
      const btn=document.createElement("button");
      btn.id=s.id; btn.className="bm-corner-btn"; btn.setAttribute('data-tooltip',s.id);
      btn.innerHTML=`${this.getButtonIcon(s.label)}<span class="btn-text">${s.label}</span>`;
      btn.style.setProperty('--btn-color',s.backgroundColor);
      btn.addEventListener('click',()=>{this.animateClick(btn); window.open(s.url,"_blank");});
      wrap.appendChild(btn);
    });

    const v=document.createElement("button");
    v.id="version"; v.className="bm-corner-btn bm-version-btn"; v.setAttribute('data-tooltip','Script Version');
    v.innerHTML=`<span class="version-icon">⚡</span><span class="btn-text">${CONFIG.version}</span>`;
    v.style.setProperty('--btn-color','#1a1a1a');
    v.addEventListener('click',()=>{this.animateClick(v); window.open("https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay%20-%20Enhanced.js","_blank");});
    wrap.appendChild(v);
  },
  getButtonIcon(label){ const icons={'SOP':'📋','MSG':'💬','Rules':'📖'}; return `<span class="btn-icon">${icons[label]||'🎲'}</span>`; },
  addCornerButtonStyles(){
    const style=document.createElement("style");
    style.innerHTML=`
      @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(var(--btn-color-rgb),.7);}70%{box-shadow:0 0 0 10px rgba(var(--btn-color-rgb),0);}100%{box-shadow:0 0 0 0 rgba(var(--btn-color-rgb),0);}}
      @keyframes clickWave{0%{transform:scale(1);}50%{transform:scale(.95);}100%{transform:scale(1);}}
      .bm-corner-btn{position:relative;display:flex;align-items:center;gap:6px;min-width:45px;height:36px;padding:8px 12px;border:none;border-radius:12px;background:linear-gradient(135deg,var(--btn-color) 0%,color-mix(in srgb,var(--btn-color) 80%,black) 100%);color:white;font-weight:600;font-size:11px;cursor:pointer;overflow:hidden;transition:all .3s cubic-bezier(.4,0,.2,1);box-shadow:0 4px 12px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(10px);--btn-color-rgb:255,255,255;}
      .bm-corner-btn::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transition:left .5s;}
      .bm-corner-btn:hover::before{left:100%;}
      .bm-corner-btn:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 8px 20px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.3);filter:brightness(1.1);}
      .bm-corner-btn:active{animation:clickWave .2s ease-out;}
      .bm-corner-btn .btn-icon{font-size:14px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));}
      .bm-corner-btn .btn-text{text-shadow:0 1px 2px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
      .bm-version-btn{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 50%,#1a1a1a 100%)!important;border:1px solid #333;}
      .bm-version-btn .version-icon{animation:pulse 2s infinite;color:#00ff88;}
      .bm-corner-btn::after{content:attr(data-tooltip);position:absolute;bottom:-35px;left:50%;transform:translateX(-50%);padding:4px 8px;background:rgba(0,0,0,.9);color:white;font-size:10px;border-radius:4px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .3s;z-index:100000;}
      .bm-corner-btn:hover::after{opacity:1;}
      @media(max-width:768px){.bm-corner-btn .btn-text{display:none;}.bm-corner-btn{min-width:36px;padding:8px;}}
    `;
    document.head.appendChild(style);
  },
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
      console.log(`Cached admin status for ${steamID}`);
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
    console.log("Admin cache cleared");
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

    console.log(`Admin cache cleaned up, ${this.adminCache.size} entries remaining`);
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

      console.log(`Admin force refresh: refreshed ${refreshed} admin badges`);
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
    console.log('CBL: observing player list for dynamic rows + scroll events');
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

    console.log('CBL: scroll observer setup complete');
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

      if (refreshed > 0) {
        console.log(`CBL scroll refresh: refreshed ${refreshed} visible elements`);
      }
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
      console.log(`CBL scan: styled ${count} rows (enhanced caching active).`);
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
      if(applied) console.log(`CBL fastRescan: re-applied for ${applied} rows + admin badges (enhanced cache).`);
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
      console.log(`CBL data for ${steamID}:`,parsed);
      return parsed;
    }catch(e){
      console.log(`No CBL data for ${steamID}:`,e?.message||e);
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
    if(!nameEl.dataset.cblLogged){ console.log(`Applied CBL coloring: ${nameEl.textContent.trim()} - Rating ${riskRating}, Active ${activeBans}`); nameEl.dataset.cblLogged="1"; }
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
    console.log("CBL Player List Manager soft reset (enhanced cache preserved)");
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
    console.log("CBL Player List Manager full reset (including enhanced caches)");
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

      console.log(`CBL force refresh: refreshed ${refreshed} elements`);
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

      console.log('Cache warmed from storage, applying cached styling...');

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

      console.log(`Cache warming completed: ${applied} elements styled from cache`);

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

    console.log('Aggressive caching enabled');
  }
};

// ========================================
// LOG PROCESSOR (no admin-name matching; keeps action highlighting)
// ========================================
const LogProcessor = {
  processedMessages: new Set(), // Track processed messages to prevent duplicates
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

    // NEW: Detect !admin commands for notifications
    this.detectAdminCommands();

    // NEW: Setup chat observer for real-time detection (only once)
    if (!this.chatObserverSetup) {
      this.setupChatObserver();
      this.chatObserverSetup = true;
    }
  },

  // NEW: Detect !admin commands in chat logs
  detectAdminCommands() {
    // Throttle admin command detection to prevent console spam
    const now = Date.now();
    if (!this.lastAdminCheck) this.lastAdminCheck = 0;
    if (now - this.lastAdminCheck < 5000) return; // Only run every 5 seconds
    this.lastAdminCheck = now;

    // Only run if we're on the main RCON page
    if (!window.location.href.match(/\/rcon\/servers\/\d+(?:\/.*)?$/)) {
      return;
    }

    // Only run if admin notification system is initialized
    if (!AdminNotificationSystem.isInitialized) {
      return;
    }

    // Check for new messages that might have been added
    this.checkForNewAdminCommands();

        // Try multiple selectors for chat messages
    const chatSelectors = [
      SELECTORS.messageLog,
      '.css-ym7lu8', // Fallback to hardcoded selector
      '[data-testid="chat-message"]', // Alternative selector
      '.chat-message', // Generic chat message class
      '.log-entry' // Generic log entry class
    ];

    for (const selector of chatSelectors) {
      Utils.safeQuery(selector, els => {
        els.forEach(el => {
          const text = el.textContent || '';

          // Check if this is a new !admin command (avoid processing same message multiple times)
          if (text.toLowerCase().includes('!admin') && !el.dataset.adminProcessed) {
            // Create a unique hash for this message to prevent duplicates
            const messageHash = this.createMessageHash(text);

            // Check if we've already processed this exact message
            if (this.processedMessages.has(messageHash)) {
              el.dataset.adminProcessed = 'true';
              return; // Skip this message
            }

            // Mark as processed
            el.dataset.adminProcessed = 'true';
            this.processedMessages.add(messageHash);

            // Extract player info from the log entry
            const playerInfo = this.extractPlayerInfoFromLog(el);
            if (playerInfo) {
              const { playerName, message } = playerInfo;

              // Check if it's actually a !admin command
              AdminNotificationSystem.detectAdminCommand(message, playerName);
            }
          }
        });
      });
    }
  },

  // NEW: Extract player info from log entry
  extractPlayerInfoFromLog(logElement) {
    try {
      const text = logElement.textContent || '';

      // Look for chat patterns like "(ChatAdmin) PlayerName: message" or "(All) PlayerName: message"
      const chatPatterns = [
        /^\([^)]+\)\s*([^:]+):\s*(.+)$/,  // (ChatAdmin) PlayerName: message
        /^([^:]+):\s*(.+)$/               // PlayerName: message
      ];

      for (const pattern of chatPatterns) {
        const match = text.match(pattern);
        if (match) {
          const playerName = match[1].trim();
          const message = match[2].trim();

          // Check if this message contains !admin
          if (message.toLowerCase().includes('!admin')) {
            return { playerName, message };
          }
        }
      }

      return null;

    } catch (e) {
      return null;
    }
  },

  // Check for new admin commands (called by MutationObserver)
  checkForNewAdminCommands() {
    // Use comprehensive selectors including the one from screenshot
    const chatSelectors = [
      '.css-1x8dg53', // Main chat container from screenshot
      '.css-1x8dg53 .css-1x8dg53', // Nested chat elements
      '.css-ym7lu8', // Message log selector
      SELECTORS.messageLog,
      '[data-testid="chat-message"]',
      '.chat-message',
      '.log-entry'
    ];

    // Also check for the specific chat structure we see in the console
    const specificSelectors = [
      '.css-ecfywz .css-ym7lu8', // The specific structure from your console
      'div[style*="position: absolute"] .css-ym7lu8', // Absolute positioned containers
      '.css-ecfywz div[class*="css-"]', // Any css-* class in the ecfywz containers
    ];

    // Combine all selectors
    const allSelectors = [...chatSelectors, ...specificSelectors];

    for (const selector of allSelectors) {
      Utils.safeQuery(selector, els => {
        els.forEach(el => {
          const text = el.textContent || '';

          // Check if this is a new !admin command (avoid processing same message multiple times)
          if (text.toLowerCase().includes('!admin') && !el.dataset.adminProcessed) {
            // Create a unique hash for this message to prevent duplicates
            const messageHash = this.createMessageHash(text);

            // Check if we've already processed this exact message
            if (this.processedMessages.has(messageHash)) {
              el.dataset.adminProcessed = 'true';
              return; // Skip this message
            }

            // Mark as processed
            el.dataset.adminProcessed = 'true';
            this.processedMessages.add(messageHash);

            // Extract player info from the log entry
            const playerInfo = this.extractPlayerInfoFromLog(el);
            if (playerInfo) {
              const { playerName, message } = playerInfo;

              // Check if it's actually a !admin command
              AdminNotificationSystem.detectAdminCommand(message, playerName);
            }
          }
        });
      });
    }

    // Also check for any elements that might have been added recently
    // Look for elements with recent timestamps or that are newly visible
    const timeElements = document.querySelectorAll('time[datetime]');
    timeElements.forEach(timeEl => {
      const parent = timeEl.closest('.css-ecfywz');
      if (parent) {
        const messageEl = parent.querySelector('.css-ym7lu8');
        if (messageEl && !messageEl.dataset.adminProcessed) {
          const text = messageEl.textContent || '';

          if (text.toLowerCase().includes('!admin')) {
            const messageHash = this.createMessageHash(text);

            if (!this.processedMessages.has(messageHash)) {
              messageEl.dataset.adminProcessed = 'true';
              this.processedMessages.add(messageHash);

              const playerInfo = this.extractPlayerInfoFromLog(messageEl);
              if (playerInfo) {
                const { playerName, message } = playerInfo;
                AdminNotificationSystem.detectAdminCommand(message, playerName);
              }
            }
          }
        }
      }
    });
  },

  // Check recent messages for !admin commands
  checkRecentMessages() {
    // Focus on the last few messages that are most likely visible
    const recentSelectors = [
      '.css-ecfywz:last-child .css-ym7lu8',
      '.css-ecfywz:nth-last-child(-n+3) .css-ym7lu8' // Last 3 messages
    ];

    for (const selector of recentSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el && !el.dataset.adminProcessed) {
          const text = el.textContent || '';

          if (text.toLowerCase().includes('!admin')) {
            const messageHash = this.createMessageHash(text);

            if (!this.processedMessages.has(messageHash)) {
              el.dataset.adminProcessed = 'true';
              this.processedMessages.add(messageHash);

              const playerInfo = this.extractPlayerInfoFromLog(el);
              if (playerInfo) {
                const { playerName, message } = playerInfo;
                AdminNotificationSystem.detectAdminCommand(message, playerName);
              }
            }
          }
        }
      });
    }
  },

  // Setup MutationObserver to watch for new chat messages
  setupChatObserver() {
    // Find the chat container with multiple selectors including the one from screenshot
    const chatSelectors = [
      SELECTORS.logContainer,
      '.css-1x8dg53', // Main chat container from screenshot
      '.css-1x8dg53 .css-1x8dg53', // Nested chat elements
      '.css-b7r34x',
      '[data-testid="chat-container"]'
    ];

    let chatContainer = null;
    for (const selector of chatSelectors) {
      chatContainer = document.querySelector(selector);
      if (chatContainer) {
        break;
      }
    }

    if (!chatContainer) {
      setTimeout(() => this.setupChatObserver(), 2000);
      return;
    }

    // Create MutationObserver to watch for new messages
    const observer = new MutationObserver((mutations) => {
      let hasNewMessages = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any new nodes contain chat messages
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || '';
              if (text.toLowerCase().includes('!admin')) {
                hasNewMessages = true;
              }
            }
          });
        }
      });

      // If new messages were added, check for admin commands
      if (hasNewMessages) {
        // Process immediately for faster response
        this.checkForNewAdminCommands();

        // Also do a quick scan of the entire chat for any !admin commands we might have missed
        setTimeout(() => {
          this.scanOffScreenMessages();
        }, 500);
      }
    });

    // Start observing the chat container
    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // NEW: Also scan for existing off-screen messages
    this.scanOffScreenMessages();

    // NEW: Set up more frequent scanning for off-screen messages
    setInterval(() => {
      this.scanOffScreenMessages();
    }, 5000); // Scan every 5 seconds instead of 10

    // NEW: Add scroll event listener to catch messages when scrolling
    if (chatContainer) {
      chatContainer.addEventListener('scroll', () => {
        // Small delay to ensure DOM is updated after scroll
        setTimeout(() => {
          this.checkForNewAdminCommands();
        }, 100);
      });
    }

    // NEW: Set up a more aggressive interval to constantly check for new messages
    setInterval(() => {
      this.checkForNewAdminCommands();
    }, 1000); // Check every 1 second for any new !admin commands

    // NEW: Also watch the entire document body for any changes that might include new chat messages
    const bodyObserver = new MutationObserver((mutations) => {
      let hasPotentialChatChanges = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any new nodes might contain chat content
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Look for elements that might be chat messages
              const potentialChatElements = node.querySelectorAll && node.querySelectorAll('.css-ecfywz, .css-ym7lu8, time[datetime]');
              if (potentialChatElements && potentialChatElements.length > 0) {
                hasPotentialChatChanges = true;
              }

              // Also check if the node itself is a chat element
              if (node.classList && (node.classList.contains('css-ecfywz') || node.classList.contains('css-ym7lu8'))) {
                hasPotentialChatChanges = true;
              }
            }
          });
        }
      });

      // If we detect potential chat changes, do a quick scan
      if (hasPotentialChatChanges) {
        setTimeout(() => {
          this.checkForNewAdminCommands();
        }, 100);
      }
    });

    // Start observing the entire document body
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check recent messages every 500ms
    setInterval(() => {
      this.checkRecentMessages();
    }, 500);

    // NEW: Also watch for any new elements being added anywhere in the DOM
    // This catches messages even when they're added to off-screen areas
    const aggressiveObserver = new MutationObserver((mutations) => {
      let hasNewElements = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is a chat message container
              if (node.classList && node.classList.contains('css-ecfywz')) {
                hasNewElements = true;
              }

              // Also check if it contains chat message content
              if (node.querySelector && node.querySelector('.css-ym7lu8')) {
                hasNewElements = true;
              }
            }
          });
        }
      });

      // If we detect new chat elements, scan immediately
      if (hasNewElements) {
        this.checkRecentMessages();

        // Also do a full scan after a short delay
        setTimeout(() => {
          this.checkForNewAdminCommands();
        }, 200);
      }
    });

    // Start observing the entire document body
    aggressiveObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  // Scan for off-screen messages that might contain !admin commands
  scanOffScreenMessages() {
    // Use comprehensive selectors to find all chat messages
    const chatSelectors = [
      '.css-1x8dg53', // Main chat container from screenshot
      '.css-1x8dg53 .css-1x8dg53', // Nested chat elements
      '.css-ym7lu8', // Message log selector
      SELECTORS.messageLog,
      '[data-testid="chat-message"]',
      '.chat-message',
      '.log-entry'
    ];

    let totalMessages = 0;
    let adminCommands = 0;

    for (const selector of chatSelectors) {
      Utils.safeQuery(selector, els => {
        els.forEach(el => {
          totalMessages++;
          const text = el.textContent || '';

          // Check if this is a !admin command that hasn't been processed
          if (text.toLowerCase().includes('!admin') && !el.dataset.adminProcessed) {
            // Create a unique hash for this message to prevent duplicates
            const messageHash = this.createMessageHash(text);

            // Check if we've already processed this exact message
            if (this.processedMessages.has(messageHash)) {
              el.dataset.adminProcessed = 'true';
              return; // Skip this message
            }

            // Mark as processed
            el.dataset.adminProcessed = 'true';
            this.processedMessages.add(messageHash);
            adminCommands++;

            // Extract player info from the log entry
            const playerInfo = this.extractPlayerInfoFromLog(el);
            if (playerInfo) {
              const { playerName, message } = playerInfo;

              // Check if it's actually a !admin command
              AdminNotificationSystem.detectAdminCommand(message, playerName);
            }
          }
        });
      });
    }

    // Also check for any recent messages that might have been added
    this.checkRecentMessages();
  },

  // Check for recent messages that might have been added to the chat
  checkRecentMessages() {
    // Look for messages that might have been added recently
    const recentSelectors = [
      '.css-1x8dg53 > *:last-child', // Last child of main chat container
      '.css-1x8dg53 .css-1x8dg53 > *:last-child', // Last child of nested containers
      '.css-ym7lu8 > *:last-child', // Last message log entry
      SELECTORS.messageLog + ' > *:last-child' // Last message log entry
    ];

    for (const selector of recentSelectors) {
      const recentElement = document.querySelector(selector);
      if (recentElement && !recentElement.dataset.adminProcessed) {
        const text = recentElement.textContent || '';

        if (text.toLowerCase().includes('!admin')) {
          // Create a unique hash for this message to prevent duplicates
          const messageHash = this.createMessageHash(text);

          // Check if we've already processed this exact message
          if (!this.processedMessages.has(messageHash)) {
            // Mark as processed
            recentElement.dataset.adminProcessed = 'true';
            this.processedMessages.add(messageHash);

            // Extract player info from the log entry
            const playerInfo = this.extractPlayerInfoFromLog(recentElement);
            if (playerInfo) {
              const { playerName, message } = playerInfo;

              // Check if it's actually a !admin command
              AdminNotificationSystem.detectAdminCommand(message, playerName);
            }
          }
        }
      }
    }
  },

  // NEW: Create a unique hash for a message to prevent duplicates
  createMessageHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  },

  // NEW: Helper method to find Steam ID nearby
  findSteamIDNearby(element) {
    try {
      // Look in the current element
      const steamMatch = element.textContent?.match(/(765\d{14,})/);
      if (steamMatch) return steamMatch[1];

      // Look in parent elements
      let parent = element.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        const steamMatch = parent.textContent?.match(/(765\d{14,})/);
        if (steamMatch) return steamMatch[1];
        parent = parent.parentElement;
      }

      // Look in sibling elements
      const siblings = element.parentElement?.children;
      if (siblings) {
        for (const sibling of siblings) {
          const steamMatch = sibling.textContent?.match(/(765\d{14,})/);
          if (steamMatch) return steamMatch[1];
        }
      }

      return null;
    } catch (e) {
      return null;
    }
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
// ADMIN NOTIFICATION SYSTEM (NEW)
// ========================================
const AdminNotificationSystem = {
  notifications: [],
  isInitialized: false,
  soundEnabled: true,
  processedMessages: new Set(), // Track processed messages to avoid duplicates

  init() {
    if (this.isInitialized) return;

    this.addNotificationStyles();
    this.setupNotificationContainer();

    // Ensure button is positioned after page is fully loaded
    setTimeout(() => this.forceReposition(), 2000);

    this.isInitialized = true;
  },

  addNotificationStyles() {
    const styles = `
      .dmh-admin-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        border: 2px solid #e94560;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(233,69,96,0.3);
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 100000;
        transform: translateX(450px);
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        overflow: hidden;
        pointer-events: auto;
      }

      .dmh-admin-notification.show {
        transform: translateX(0);
      }

      .dmh-admin-notification::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #e94560, #f39c12, #e94560);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .dmh-admin-notification-header {
        background: linear-gradient(135deg, #e94560 0%, #c44569 100%);
        padding: 15px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .dmh-admin-notification-icon {
        font-size: 24px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }

      .dmh-admin-notification-title {
        font-size: 18px;
        font-weight: 700;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        flex: 1;
      }

      .dmh-admin-notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        transition: all 0.3s ease;
        opacity: 0.8;
      }

      .dmh-admin-notification-close:hover {
        opacity: 1;
        background: rgba(255,255,255,0.1);
        transform: scale(1.1);
      }

      .dmh-admin-notification-content {
        padding: 20px;
      }

      .dmh-admin-notification-player {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        padding: 12px;
        background: rgba(233,69,96,0.1);
        border-radius: 10px;
        border-left: 4px solid #e94560;
      }

      .dmh-admin-notification-player-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }

      .dmh-admin-notification-player-info {
        flex: 1;
      }

      .dmh-admin-notification-player-name {
        font-size: 16px;
        font-weight: 600;
        color: #e94560;
        margin-bottom: 4px;
      }

      .dmh-admin-notification-player-steam {
        font-size: 12px;
        color: #bdc3c7;
        font-family: 'Courier New', monospace;
      }

      .dmh-admin-notification-issue {
        background: rgba(255,255,255,0.05);
        padding: 15px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 15px;
      }

      .dmh-admin-notification-issue-label {
        font-size: 12px;
        color: #bdc3c7;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
      }

      .dmh-admin-notification-issue-text {
        font-size: 14px;
        line-height: 1.4;
        color: #ecf0f1;
      }

      .dmh-admin-notification-timestamp {
        font-size: 11px;
        color: #95a5a6;
        text-align: right;
        font-style: italic;
      }

      .dmh-admin-notification-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }

      .dmh-admin-notification-btn {
        flex: 1;
        padding: 10px 15px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .dmh-admin-notification-btn-primary {
        background: linear-gradient(135deg, #e94560 0%, #c44569 100%);
        color: white;
      }

      .dmh-admin-notification-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(233,69,96,0.4);
      }

      .dmh-admin-notification-btn-secondary {
        background: rgba(255,255,255,0.1);
        color: #bdc3c7;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .dmh-admin-notification-btn-secondary:hover {
        background: rgba(255,255,255,0.2);
        color: white;
      }

      .dmh-admin-notification-enter {
        animation: slideInRight 0.5s ease-out;
      }

      .dmh-admin-notification-exit {
        animation: slideOutRight 0.5s ease-in;
      }

      @keyframes slideInRight {
        from { transform: translateX(450px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(450px); opacity: 0; }
      }

      .dmh-admin-notification-sound-toggle {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        border: 2px solid #e94560;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      }

      .dmh-admin-notification-sound-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
      }

      .dmh-admin-notification-sound-toggle.muted {
        opacity: 0.5;
        border-color: #95a5a6;
      }

      /* When placed inside the top-right button bar, style like other buttons */
      .bm-button-container .dmh-admin-notification-sound-toggle {
        border: none !important;
        border-radius: 12px !important;
        width: auto !important;
        height: 36px !important;
        padding: 8px 12px !important;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
      }

      /* Multiple notifications stacking */
      .dmh-admin-notifications-container .dmh-admin-notification:nth-child(2) {
        top: 140px;
      }

      .dmh-admin-notifications-container .dmh-admin-notification:nth-child(3) {
        top: 260px;
      }

      .dmh-admin-notifications-container .dmh-admin-notification:nth-child(4) {
        top: 380px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .dmh-admin-notification {
          width: 90vw;
          right: 5vw;
          left: 5vw;
        }

        .dmh-admin-notification-sound-toggle {
          right: 20px;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  },

  setupNotificationContainer() {
    // Create sound toggle button positioned next to SOP button
    const soundToggle = document.createElement('div');
    soundToggle.className = 'dmh-admin-notification-sound-toggle';
    soundToggle.innerHTML = '🔊';
    soundToggle.title = 'Toggle notification sound';
    soundToggle.addEventListener('click', () => this.toggleSound());

    // Prefer placing inside our existing button container as the FIRST child
    // so it sits to the LEFT of the SOP button and inherits the same 8px gap
    const btnWrap = document.querySelector('.bm-button-container');
    if (btnWrap) {
      // Style it like other buttons
      soundToggle.classList.add('bm-corner-btn');
      soundToggle.setAttribute('data-tooltip', 'Sound');
      soundToggle.style.setProperty('--btn-color', '#2c3e50');
      // Remove any absolute/fixed positioning if present
      soundToggle.style.position = '';
      soundToggle.style.top = '';
      soundToggle.style.right = '';
      soundToggle.style.width = '';
      soundToggle.style.height = '';
      soundToggle.style.border = '';
      soundToggle.style.borderRadius = '';
      soundToggle.style.boxShadow = '';
      // Insert as first child (left of SOP)
      btnWrap.insertBefore(soundToggle, btnWrap.firstChild);
    } else {
      // Fallback: position absolutely near the SOP area
      document.body.appendChild(soundToggle);
      this.positionSoundToggle(soundToggle);
    }

    // Create notification container
    const container = document.createElement('div');
    container.id = 'dmh-admin-notifications-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999;';
    document.body.appendChild(container);


  },

  // Simple positioning like other buttons
  positionSoundToggle(soundToggle) {
    // If the button is already inside our flex container, do nothing.
    if (soundToggle && soundToggle.closest('.bm-button-container')) {
      // Ensure no absolute positioning when inside the flex container
      soundToggle.style.position = '';
      soundToggle.style.top = '';
      soundToggle.style.right = '';
      soundToggle.style.width = '';
      soundToggle.style.height = '';
      soundToggle.style.border = '';
      soundToggle.style.borderRadius = '';
      soundToggle.style.boxShadow = '';
      return;
    }

    // Position to the left of the SOP button with same spacing (fallback mode)
    soundToggle.style.position = 'absolute';
    soundToggle.style.top = '105px';
    soundToggle.style.right = 'calc(1% + 70px + 8px)'; // Left of SOP button with 8px gap
    soundToggle.style.zIndex = '99999';
    soundToggle.style.display = 'flex';
    soundToggle.style.alignItems = 'center';
    soundToggle.style.justifyContent = 'center';
    soundToggle.style.width = '70px';
    soundToggle.style.height = '36px';
    soundToggle.style.borderRadius = '8px';
    soundToggle.style.backgroundColor = '#2c3e50';
    soundToggle.style.border = '1px solid #34495e';
    soundToggle.style.cursor = 'pointer';
    soundToggle.style.fontSize = '16px';
    soundToggle.style.transition = 'all 0.3s ease';
    soundToggle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  },



  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const toggle = document.querySelector('.dmh-admin-notification-sound-toggle');
    if (this.soundEnabled) {
      toggle.innerHTML = '🔊';
      toggle.classList.remove('muted');
      toggle.title = 'Sound enabled';
    } else {
      toggle.innerHTML = '🔇';
      toggle.classList.add('muted');
      toggle.title = 'Sound disabled';
    }
  },

  // Detect !admin commands in chat logs
  detectAdminCommand(messageText, playerName) {
    const adminCommandRegex = /^!admin\s+(.+)$/i;
    const match = messageText.match(adminCommandRegex);

    if (match) {
      const issue = match[1].trim();

      try {
        this.showNotification(playerName, issue);
        return true;
      } catch (error) {
        return false;
      }
    }

    return false;
  },

  // Show notification popup
  showNotification(playerName, issue) {
    try {
      const notification = this.createNotification(playerName, issue);

      // Add to container
      const container = document.getElementById('dmh-admin-notifications-container');

      if (!container) {
        this.setupNotificationContainer();
        const newContainer = document.getElementById('dmh-admin-notifications-container');
        if (newContainer) {
          newContainer.appendChild(notification);
        } else {
          return;
        }
      } else {
        container.appendChild(notification);
      }

      // Show notification with animation
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);

      // Play sound if enabled
      if (this.soundEnabled) {
        this.playNotificationSound();
      }

      // Auto-hide after 10 minutes (600,000ms)
      setTimeout(() => {
        this.hideNotification(notification);
      }, 600000);

      // Store notification reference
      this.notifications.push(notification);
    } catch (error) {
      // Silent error handling
    }
  },

  // Create notification element
  createNotification(playerName, issue) {
    const notification = document.createElement('div');
    notification.className = 'dmh-admin-notification';

    const timestamp = new Date().toLocaleTimeString();
    const playerInitials = this.getPlayerInitials(playerName);

    notification.innerHTML = `
      <div class="dmh-admin-notification-header">
        <span class="dmh-admin-notification-icon">🚨</span>
        <span class="dmh-admin-notification-title">Admin Request</span>
        <button class="dmh-admin-notification-close" onclick="this.closest('.dmh-admin-notification').remove()">×</button>
      </div>

      <div class="dmh-admin-notification-content">
        <div class="dmh-admin-notification-player">
          <div class="dmh-admin-notification-player-avatar">${playerInitials}</div>
          <div class="dmh-admin-notification-player-info">
            <div class="dmh-admin-notification-player-name">${this.escapeHtml(playerName)}</div>
          </div>
        </div>

        <div class="dmh-admin-notification-issue">
          <div class="dmh-admin-notification-issue-label">Reported Issue</div>
          <div class="dmh-admin-notification-issue-text">${this.escapeHtml(issue)}</div>
        </div>

        <div class="dmh-admin-notification-timestamp">${timestamp}</div>

        <div class="dmh-admin-notification-actions">
          <button class="dmh-admin-notification-btn dmh-admin-notification-btn-secondary" onclick="this.closest('.dmh-admin-notification').remove()">
            Dismiss
          </button>
        </div>
      </div>
    `;

    return notification;
  },

  // Hide notification with animation
  hideNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('dmh-admin-notification-exit');

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }

      // Remove from notifications array
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, 500);
  },

  // Get player initials for avatar
  getPlayerInitials(name) {
    if (!name) return '?';

    // Handle special characters and tags
    const cleanName = name.replace(/[『』\[\]()]/g, '').trim();
    const words = cleanName.split(' ').filter(word => word.length > 0);

    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  },

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Play notification sound
  playNotificationSound() {
    try {
      // Create a simple notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn('Could not play notification sound:', e);
    }
  },

  // Clear all notifications
  clearAll() {
    this.notifications.forEach(notification => {
      if (notification.parentElement) {
        notification.remove();
      }
    });
    this.notifications = [];
  },

  // Manual test function for debugging
  testNotification() {
    this.showNotification('Test Player', 'This is a test admin request for debugging');
    return true;
  },

  // NEW: Manual test with specific message (for debugging)
  manualTestAdminNotification(messageText) {
    const playerInfo = {
      playerName: 'TestPlayer'
    };P

    this.detectAdminCommand(messageText, playerInfo.playerName);
  },

  // NEW: Reposition sound toggle button (useful for layout changes)
  repositionSoundToggle() {
    const soundToggle = document.querySelector('.dmh-admin-notification-sound-toggle');
    if (!soundToggle) return;
    const inWrap = !!soundToggle.closest('.bm-button-container');
    if (inWrap) {
      // Keep it styled like other buttons and clear absolute positioning
      soundToggle.classList.add('bm-corner-btn');
      soundToggle.style.position = '';
      soundToggle.style.top = '';
      soundToggle.style.right = '';
      soundToggle.style.width = '';
      soundToggle.style.height = '';
      soundToggle.style.border = '';
      soundToggle.style.borderRadius = '';
      soundToggle.style.boxShadow = '';
      return;
    }
    this.positionSoundToggle(soundToggle);
  },

  // NEW: Force reposition with delay (useful for testing)
  forceReposition() {
    setTimeout(() => {
      const soundToggle = document.querySelector('.dmh-admin-notification-sound-toggle');
      if (!soundToggle) return;
      const inWrap = !!soundToggle.closest('.bm-button-container');
      if (inWrap) {
        // Ensure it retains button styling and no absolute positioning
        soundToggle.classList.add('bm-corner-btn');
        soundToggle.style.position = '';
        soundToggle.style.top = '';
        soundToggle.style.right = '';
        soundToggle.style.width = '';
        soundToggle.style.height = '';
        soundToggle.style.border = '';
        soundToggle.style.borderRadius = '';
        soundToggle.style.boxShadow = '';
        return;
      }
      this.positionSoundToggle(soundToggle);
    }, 1000);
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
          console.log('Returning to RCON page from player page - warming cache...');

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
        console.log('Navigating to player page - saving cache...');
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

    console.log('Global scroll handling setup complete');
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
        console.log('Periodic cache cleanup completed');
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
      console.log('Force refresh completed');
    } catch (e) {
      console.warn('Force refresh error:', e);
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
    console.log("Initializing BattleMetrics Overlay Enhanced...");

    StyleManager.init();
    UIComponents.createCornerButtons();
    RouterWatch.init();

    // NEW: Initialize admin notification system
    AdminNotificationSystem.init();

    this.startUpdateLoop();
    this.isInitialized=true;

    // NEW: Setup global debugging utilities
    this.setupGlobalUtilities();

    console.log("BattleMetrics Overlay Enhanced initialized successfully");
    console.log("Debug commands available: Utils.debugCacheStatus(), Utils.forceRefreshAllStyling(), Utils.clearAllCaches()");
    console.log("Admin notifications are now active - !admin commands will trigger popup notifications");
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
      // NEW: Admin notification utilities
      adminNotifications: {
        test: () => AdminNotificationSystem.testNotification(),
        clear: () => AdminNotificationSystem.clearAll(),
        toggleSound: () => AdminNotificationSystem.toggleSound(),
        reposition: () => AdminNotificationSystem.repositionSoundToggle(),
        forceReposition: () => AdminNotificationSystem.forceReposition(),
        manualTest: (message) => AdminNotificationSystem.manualTestAdminNotification(message),
        getStatus: () => ({
          initialized: AdminNotificationSystem.isInitialized,
          soundEnabled: AdminNotificationSystem.soundEnabled,
          activeNotifications: AdminNotificationSystem.notifications.length
        })
      }
    };

    console.log("Global debug utilities available: window.DMH_DEBUG");
    console.log("Persistent storage utilities: window.DMH_DEBUG.persistentStorage");
    console.log("Admin notification utilities: window.DMH_DEBUG.adminNotifications");
  }
}

const overlay = new BMOverlay();
overlay.observeDOM();

// Make AdminNotificationSystem globally accessible for testing
window.AdminNotificationSystem = AdminNotificationSystem;

// Add immediate testing functions (available before full initialization)
window.testAdminNotification = () => {
  if (window.AdminNotificationSystem) {
    window.AdminNotificationSystem.testNotification();
  }
};

window.manualTestAdminNotification = (message) => {
  if (window.AdminNotificationSystem) {
    window.AdminNotificationSystem.manualTestAdminNotification(message);
  }
};
