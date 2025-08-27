// File: DMH Overlay Enhanced.js
// ==UserScript==
// @name DMH BattleMetrics Overlay - Enhanced
// @namespace https://www.battlemetrics.com/
// @version 3.4
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
  version: "3.4",
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

    this.startUpdateLoop();
    this.isInitialized=true;
    
    // NEW: Setup global debugging utilities
    this.setupGlobalUtilities();
    
    console.log("BattleMetrics Overlay Enhanced initialized successfully");
    console.log("Debug commands available: Utils.debugCacheStatus(), Utils.forceRefreshAllStyling(), Utils.clearAllCaches()");
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
      enableAggressive: () => CBLPlayerListManager.enableAggressiveCaching()
    };
    
    console.log("Global debug utilities available: window.DMH_DEBUG");
    console.log("Persistent storage utilities: window.DMH_DEBUG.persistentStorage");
  }
}

const overlay = new BMOverlay();
overlay.observeDOM();
