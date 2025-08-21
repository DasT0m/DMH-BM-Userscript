// File: DMH Overlay Enhanced.js
// ==UserScript==
// @name DMH BattleMetrics Overlay - Enhanced
// @namespace https://www.battlemetrics.com/
// @version 3.0
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
  version: "3.0",
  updateRate: 150,

  servers: [
    { id: "SOP", label: "SOP", url: "https://docs.google.com/document/d/e/2PACX-1vTETPd69RXThe_gTuukFXeeMVTOhMvyzGmyeuXFKkHYd_Cg4CTREEwP2K61u_sWOleMJrkMKwQbBnCB/pub", backgroundColor: "Grey" },
    { id: "MSG", label: "MSG", url: "https://docs.google.com/spreadsheets/d/1hBLYNHUahW3UxxOUJTb1GnZwo3HpmBSFTC3-Nbz-RXk/edit?gid=1852943146#gid=1852943146", backgroundColor: "Green" },
    { id: "Rules", label: "Rules", url: "https://docs.google.com/document/d/e/2PACX-1vQzcm1es81lsxBEnXmSPRlqSS8Wgm04rd0KTmeJn88CN3Lo8pg1sT2-C1WTEXDBJfiDmW7Y6sJwv-Vi/pub", backgroundColor: "Blue" }
  ],

  graphqlEndpoint: "https://communitybanlist.com/graphql",
  adminListURL: "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/admins.json"
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
  activityName: ".css-fj458c",
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
// UTILS
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
  escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
};

// ========================================
// STYLES
// ========================================
const StyleManager = {
  init(){
    const styles = {
      zShift: ".css-ym7lu8{z-index:2;}","zShiftTime":".css-z1s6qn{z-index:3;}",
      zShiftTimeDate:".css-1jtoyp{z-index:3;}",
      teamkillBar:".css-1tuqie1{background-color:#5600ff1a;width:1920px}",
      moderationBar:".css-1rwnm41{background-color:#ff000008;width:1920px;}",
      adminCam:".css-1fy5con{background-color:#31e3ff21;width:1920px}",
      nobranding:"#RCONLayout > nav > ul > li.css-1nxi32t > a{background-color:#31e3ff21;width:1920px}"
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
    v.addEventListener('click',()=>{this.animateClick(v); window.open("https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/refs/heads/main/DMH%20BattleMetrics%20Overlay.js","_blank");});
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
// ADMIN BADGE DECORATOR (Enhanced with caching)
// ========================================
const AdminBadgeDecorator = {
  PURPLE_RGB: "rgb(208, 58, 250)", // from your screenshot
  SHIELD_HTML: ' <span class="dmh-admin-shield" title="DMH Admin">🛡️</span>',
  
  // NEW: Cache for admin status
  adminCache: new Map(), // steamID -> boolean
  adminElements: new WeakSet(), // track which elements we've decorated

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
  decorateName(nameEl){
    if (!nameEl) return;
    
    // Avoid duplicate shields
    if (!nameEl.querySelector('.dmh-admin-shield')) {
      nameEl.insertAdjacentHTML('beforeend', this.SHIELD_HTML);
    }
    
    // Mark as decorated to avoid re-processing
    this.adminElements.add(nameEl);
    
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

  // NEW: Check cache first, then detect and cache result
  isAdminCached(steamID, row) {
    if (!steamID) return false;
    
    // Check cache first
    if (this.adminCache.has(steamID)) {
      return this.adminCache.get(steamID);
    }
    
    // Not in cache, detect and store
    const isAdmin = this.hasAdminFlame(row);
    this.adminCache.set(steamID, isAdmin);
    
    if (isAdmin) {
      console.log(`Cached admin status for ${steamID}`);
    }
    
    return isAdmin;
  },

  // NEW: Apply decoration from cache (fast path)
  applyFromCache(nameEl, steamID) {
    if (!nameEl || !steamID) return false;
    
    const isAdmin = this.adminCache.get(steamID);
    if (isAdmin === true && !this.adminElements.has(nameEl)) {
      this.decorateName(nameEl);
      return true;
    }
    return false;
  },

  // Updated main method with caching
  maybeDecorate(row, nameEl, steamID = null){
    if (!row || !nameEl) return;
    
    // If we already decorated this element, skip
    if (this.adminElements.has(nameEl)) return;
    
    // Try cache first if we have steamID
    if (steamID && this.applyFromCache(nameEl, steamID)) {
      return;
    }
    
    // Check if admin and cache the result
    if (steamID) {
      const isAdmin = this.isAdminCached(steamID, row);
      if (isAdmin) {
        this.decorateName(nameEl);
      }
    } else {
      // Fallback for when we don't have steamID
      if (this.hasAdminFlame(row)) {
        this.decorateName(nameEl);
      }
    }
  },

  // NEW: Clear caches (useful for debugging or reset)
  clearCache() {
    this.adminCache.clear();
    this.adminElements = new WeakSet();
    console.log("Admin cache cleared");
  }
};

// ========================================
// CBL PLAYER LIST (Updated to use admin cache)
// ========================================
const CBLPlayerListManager = {
  processedPlayers:new Set(),
  cblCache:new Map(),
  coloredElements:new WeakSet(),
  processedSteamIDs:new Set(), // NEW: Track which steamIDs we've processed
  isProcessing:false,
  lastProcessTime:0,
  listObserver:null,

  observePlayerListContainer(){
    if(this.listObserver) return;
    const container =
      document.querySelector('.ReactVirtualized__Grid__innerScrollContainer') ||
      document.querySelector('[data-testid="player-table"]') ||
      document.querySelector('[role="grid"]') ||
      document.querySelector('tbody');
    if(!container) return;

    this.listObserver=new MutationObserver(muts=>{
      for(const m of muts){
        if(m.type==='childList'){
          m.addedNodes.forEach(node=>{
            if(node.nodeType!==1) return;
            if(!this.tryProcessNode(node)){
              node.querySelectorAll?.('div[role="row"], tr, div[data-session]').forEach(r=>this.tryProcessNode(r));
            }
          });
        }
      }
    });
    this.listObserver.observe(container,{childList:true,subtree:true});
    console.log('CBL: observing player list for dynamic rows');
  },

  tryProcessNode(node){
    try{
      if(!(node instanceof Element)) return false;
      const role=node.getAttribute('role');
      if(!(role==='row'||node.matches('tr')||node.hasAttribute('data-session'))) return false;
      this.processPlayerRow(node);
      return true;
    }catch{ return false; }
  },

  async processPlayerList(){
    if(this.isProcessing) return;
    if(!window.location.href.match(/\/rcon\/servers\/\d+(?:\/.*)?$/)) return;

    const now=Date.now();
    if(now-this.lastProcessTime<10000) return; // 10s window

    try{
      this.isProcessing=true; this.lastProcessTime=now;
      const rows=document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let count=0;
      for(const r of rows){ if(await this.processPlayerRow(r)) count++; }
      console.log(`CBL scan: styled ${count} rows (cached where possible).`);
    }catch(e){ console.error("CBL list scan error:",e); }
    finally{ this.isProcessing=false; }
  },

  fastRescan(){
    try{
      this.observePlayerListContainer?.();
      const rows=document.querySelectorAll('div[role="row"], tr, div[data-session]');
      let applied=0;
      rows.forEach(row=>{
        const steamID=this.extractSteamID(row);
        const nameEl=this.extractNameElement(row);
        if(!nameEl) return;
        
        // NEW: Always reapply styling for cached data (force refresh)
        if(steamID){
          const cached=this.cblCache.get(steamID);
          if(cached){
            this.applyPlayerNameColor(nameEl,cached);
          }
          
          // Always check admin status from cache
          AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
        } else {
          // Fallback admin check without steamID
          AdminBadgeDecorator.maybeDecorate(row, nameEl);
        }
        
        // NEW: Don't rely on coloredElements tracking for fastRescan
        // Always mark as processed after applying styles
        this.coloredElements.add(nameEl);
        applied++;
      });
      this.lastProcessTime=0;
      if(applied) console.log(`CBL fastRescan: re-applied for ${applied} rows + admin badges (cached).`);
    }catch(e){
      console.warn('CBL fastRescan error:',e);
    }
  },

  async processPlayerRow(row){
    try{
      const steamID=this.extractSteamID(row);
      const nameEl=this.extractNameElement(row);
      if(!nameEl) return false;
      
      // NEW: Check if we've already processed this steamID and the element hasn't been colored
      // This handles cases where DOM elements are recreated but we have cached data
      if(steamID && this.processedSteamIDs.has(steamID) && !this.coloredElements.has(nameEl)){
        // Apply cached data immediately
        const cached=this.cblCache.get(steamID);
        if(cached){
          this.applyPlayerNameColor(nameEl,cached);
        }
        AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
        this.coloredElements.add(nameEl);
        return true;
      }
      
      // Skip if already colored (existing logic)
      if(this.coloredElements.has(nameEl)) {
        // Even if previously colored, ensure admin badge shows if present (from cache)
        AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);
        return false;
      }

      // CBL first (may color differently)
      if(steamID){
        let cblData=this.cblCache.get(steamID);
        if(!cblData){
          cblData=await this.fetchCBLData(steamID);
          this.cblCache.set(steamID,cblData);
        }
        this.applyPlayerNameColor(nameEl,cblData);
        // NEW: Track that we've processed this steamID
        this.processedSteamIDs.add(steamID);
      }

      // Admin badge decoration with caching (pass steamID for cache lookup)
      AdminBadgeDecorator.maybeDecorate(row, nameEl, steamID);

      this.coloredElements.add(nameEl);
      return true;
    }catch(e){ console.warn("CBL row process error:",e); return false; }
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
    // NEW: Don't clear processedSteamIDs on soft reset to maintain cache benefits
    if(this.listObserver){
      this.listObserver.disconnect();
      this.listObserver = null;
    }
    console.log("CBL Player List Manager soft reset (cache preserved)");
  },

  reset(){
    this.processedPlayers.clear();
    this.isProcessing=false;
    this.lastProcessTime=0;
    this.coloredElements=new WeakSet();
    this.processedSteamIDs.clear(); // NEW: Clear steamID tracking
    this.cblCache.clear();
    
    // Also clear admin cache on reset
    AdminBadgeDecorator.clearCache();
    
    if(this.listObserver){
      this.listObserver.disconnect();
      this.listObserver=null;
    }
    console.log("CBL Player List Manager full reset (including admin cache)");
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
        if(el.style.color && el.style.color!=='') return;
        for(const phrase of patterns){ if(el.textContent.includes(phrase)){ el.style.color=color; if(color===COLORS.automatedMessage) el.style.opacity="0.6"; break; } }
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
// ROUTER WATCH
// ========================================
const RouterWatch = {
  lastURL: location.href,
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
  },
  onChange() {
    if (this.lastURL !== location.href) {
      this.lastURL = location.href;
      if (MainUpdater.isOnServerRCONPage()) {
        CBLPlayerListManager.observePlayerListContainer();
      }
      CBLPlayerListManager.fastRescan();
    }
  }
};

// ========================================
// MAIN UPDATE LOOP
// ========================================
const MainUpdater = {
  lastPlayerKey:null,
  async update(){
    if(!this.isLogContainerPresent()) return;
    LogProcessor.applyTimeStamps();
    LogProcessor.applyLogColoring();
    this.handlePlayerInterface();
    DialogStyler.styleDialogs();
    await this.handleCBLPlayerList();
  },
  isLogContainerPresent(){ return document.querySelector(SELECTORS.logContainer)||document.querySelector(SELECTORS.logContainerAlt); },

  async handleCBLPlayerList(){
    if(this.isOnServerRCONPage()){
      CBLPlayerListManager.observePlayerListContainer();
      await CBLPlayerListManager.processPlayerList();
    }else{
      if(CBLPlayerListManager.listObserver) {
        CBLPlayerListManager.softReset();
      }
    }
  },

  isOnServerRCONPage(){ return /\/rcon\/servers\/\d+(?:\/.*)?$/.test(location.href); },
  handlePlayerInterface(){
    const onPlayer=!!document.querySelector(SELECTORS.playerPage);
    if(onPlayer){
      Utils.ensureElement("copy-button",()=>UIComponents.createPlayerButtons());
      const m=location.href.match(/players\/(\d+)/); const pid=m?m[1]:null; const steamID=Utils.getTextByTitle("765","");
      const key=pid||steamID||null;
      if(key && key!==this.lastPlayerKey){ this.lastPlayerKey=key; Utils.removeElement("CBL-info"); this.fetchCBLData(); }
      else{ Utils.ensureElement("CBL-info",()=>this.fetchCBLData()); }
    }else{
      ["copy-button","open-url-button","CBL-info"].forEach(id=>Utils.removeElement(id)); this.lastPlayerKey=null;
    }
  },
  async fetchCBLData(){ const steamID=Utils.getTextByTitle("765","SteamID MISSING?"); await CBLManager.fetchPlayerData(steamID); }
};

// ========================================
// BOOTSTRAP
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
    console.log("BattleMetrics Overlay Enhanced initialized successfully");
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
}

const overlay=new BMOverlay();
overlay.observeDOM();
