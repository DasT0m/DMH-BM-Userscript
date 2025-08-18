/* DMH BM SCRIPT.main.js */
(function () {
  "use strict";

  // ===== Version label shown in the toolbar
  const VERSION = "1.2.0";

  // ===== GitHub raw config files (edit paths if you move files)
  const ADMIN_URL  = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/admins.json";        // { "emoji":"🛡️", "admins": ["DasT0m","Relish", ...] }
  const SERVER_URL = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/servers.json";      // { "servers": [ { "name":"Server 1", "url":"..." }, ... ] }
  const COLOR_URL  = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/color-rules.json";  // { "colors": {...}, "rules": [ {selector,phrases[],colorKey,caseInsensitive} ] }
  const DOCS_URL   = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/docs.txt";          // lines like: SOP = https://...

  // ===== CBL endpoint is fixed here (like the original)
  const CBL_GRAPHQL = "https://communitybanlist.com/graphql";

  // ===== Local cache TTL for remote JSON/text (in-memory; not GM storage)
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  const LAST_SERVER_KEY = "dmh_last_server_id";

  // ===== Fallback colors/rules
  const FALLBACK_COLORS = {
    teamBluefor:  "#4eacff",
    teamOpfor:    "#d0b1ff",
    teamIndepend: "#fd6aff",
    adminName:    "#00fff7",
    bmAdmin:      "#58ff47",
    modAction:    "#ff3333",
    adminAction:  "#37ff00",
    teamKilled:   "#ffcc00",
    leftServer:   "#d9a6a6",
    joined:       "#919191",
    grayed:       "#919191",
    tracked:      "#FF931A",
    noteIcon:     "#f5ccff"
  };

  const FALLBACK_RULES = [
    { selector: ".css-ym7lu8", phrases: ["requested the next map.", "(Global)", "changed the map to", "executed Player Action"], colorKey: "adminAction", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["AFK - Thanks for playing!", "Final warning: Get Squad Leader kit within 5m", "Please get a Squad Leader kit"], colorKey: "grayed", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["joined the server"], colorKey: "joined", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["left the server"], colorKey: "leftServer", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["was warned","was kicked","was banned","edited BattleMetrics Ban","added BattleMetrics Ban","deleted BattleMetrics Ban"], colorKey: "modAction", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["United States Army","United States Marine Corps","British Armed Forces","Canadian Armed Forces","Australian Defence Force","Turkish Land Forces"], colorKey: "teamBluefor", caseInsensitive: false },
    { selector: ".css-ym7lu8", phrases: ["Russian Ground Forces","Insurgent Forces","Middle Eastern Alliance","Middle Eastern Insurgents","Irregular Militia Forces","People's Liberation Army","Russian Airborne Forces","PLA Navy Marine Corps","PLA Amphibious Ground Forces","Western Private Military Contractors"], colorKey: "teamOpfor", caseInsensitive: false },
    { selector: ".css-ym7lu8", phrases: ["team killed"], colorKey: "teamKilled", caseInsensitive: true },
    { selector: ".css-ym7lu8", phrases: ["[SL Kit]"], colorKey: "tracked", caseInsensitive: true }
  };

  // ===== In-memory cache helpers
  const netCache = new Map(); // key -> {time, data}
  async function fetchCached(url, parser = r => r.json()) {
    const entry = netCache.get(url);
    if (entry && (Date.now() - entry.time) < CACHE_TTL) return entry.data;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
    const data = await parser(resp);
    netCache.set(url, { time: Date.now(), data });
    return data;
  }

  function debounce(fn, wait = 100, maxWait = 500) {
    let timeout, lastCall = 0;
    return (...args) => {
      const now = Date.now();
      const invoke = () => { fn(...args); lastCall = now; };
      clearTimeout(timeout);
      if (now - lastCall >= maxWait) return invoke();
      timeout = setTimeout(invoke, wait);
    };
  }
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ===== Loaders
  async function loadAdmins() {
    // { emoji: "🛡️", admins: ["Name", ...] }
    try {
      const data = await fetchCached(ADMIN_URL);
      if (Array.isArray(data)) return { emoji: "🛡️", admins: data }; // legacy array
      return data || { emoji: "🛡️", admins: [] };
    } catch {
      return { emoji: "🛡️", admins: [] };
    }
  }
  async function loadServers() {
    try {
      const data = await fetchCached(SERVER_URL);
      return data?.servers || [];
    } catch {
      return [];
    }
  }
  async function loadRules() {
    try {
      const data = await fetchCached(COLOR_URL);
      if (!data || !data.rules || !data.colors) return { rules: FALLBACK_RULES, colors: FALLBACK_COLORS };
      return data;
    } catch {
      return { rules: FALLBACK_RULES, colors: FALLBACK_COLORS };
    }
  }
  async function loadDocs() {
    try {
      const data = await fetchCached(DOCS_URL, r => r.text());
      return data.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
        const [label, url] = line.split("=").map(x => x.trim());
        return { label, url };
      });
    } catch { return []; }
  }

  // ===== UI helpers
  function applyTimeStamps(){
    document.querySelectorAll(".css-z1s6qn").forEach(el=>{
      const utc = el.getAttribute("datetime"); if (!utc) return;
      const d = new Date(utc);
      if (!isNaN(d.getTime())) el.setAttribute("title", d.toLocaleString(undefined,{ timeZoneName: "short" }));
    });
  }

  function applyDynamicColorRules(root, rulesObj) {
    const colors = rulesObj?.colors || FALLBACK_COLORS;
    const rules  = rulesObj?.rules  || FALLBACK_RULES;
    for (const r of rules) {
      const els = root.querySelectorAll(r.selector);
      if (!els.length) continue;
      const parts = r.phrases.map(escapeRe);
      const rx = new RegExp(`(?:${parts.join("|")})`, r.caseInsensitive ? "i" : "");
      const color = colors[r.colorKey] || "#fff";
      els.forEach(el => { if (rx.test(el.textContent || "")) el.style.color = color; });
    }
  }

  function applyAdminTags(root, adminData, color) {
    if (!adminData?.admins?.length) return;
    const names = adminData.admins.map(escapeRe);
    const rx = new RegExp(`\\b(?:${names.join("|")})\\b|\\b『DMH』 ?(?:${names.join("|")})\\b`, "i");
    const label = adminData.emoji || "🛡️";

    const tagOnce = (el) => {
      const txt = el.textContent || "";
      if (!rx.test(txt)) return;
      el.style.color = color;
      if (!el.dataset.adminTagged) {
        el.textContent += " " + label;
        el.dataset.adminTagged = "true";
      }
    };

    root.querySelectorAll(".css-1ewh5td, .css-fj458c").forEach(tagOnce);
    root.querySelectorAll(".css-18s4qom").forEach(el=>{
      if ((el.textContent || "").includes("Admin")) el.style.color = FALLBACK_COLORS.bmAdmin;
    });
    root.querySelectorAll(".css-he5ni6").forEach(el=>{
      el.style.color = FALLBACK_COLORS.noteIcon;
    });
  }

  function colorServerMenus() {
    const menuMap = [
      { phrases: ["Change Layer"],                 color: "red"    },
      { phrases: ["Set Next Layer","Next Layer"],  color: "lime"   },
      { phrases: ["Kick"],                         color: "orange" },
      { phrases: ["Warn"],                         color: "lime"   },
      { phrases: ["Ban"],                          color: "red"    },
      { phrases: ["Squad List"],                   color: "gold"   }
    ];
    const menus = document.querySelectorAll(".dropdown-menu, .modal, .css-yun63y, .css-1ixz43s, .css-f5o5h6");
    menus.forEach(menu=>{
      menu.querySelectorAll("a, button, li, span").forEach(el=>{
        const t = (el.textContent || "").trim().toLowerCase();
        for (const m of menuMap) {
          if (m.phrases.some(p => t.includes(p.toLowerCase()))) { el.style.color = m.color; break; }
        }
      });
    });
  }

  async function buildToolbar(versionText, servers) {
    const old = document.getElementById("dmh-toolbar");
    if (old) old.remove();

    const bar = document.createElement("div");
    bar.id = "dmh-toolbar";
    bar.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      display: flex; align-items: center; gap: 8px;
      background: rgba(20,22,25,0.92);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
      padding: 6px 10px; border-radius: 12px;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Helvetica Neue",Arial,sans-serif;
      z-index: 999999; user-select: none;
    `;

    // drag handle
    const handle = document.createElement("div");
    handle.textContent = "≡";
    handle.title = "Drag";
    handle.style.cssText = `
      width: 22px; height: 22px; line-height: 22px; text-align: center;
      background:#353a40; border: 1px solid #4d535b; color: #fff; border-radius: 6px;
      cursor: grab; font-weight: 700;
    `;

    // collapse
    const collapse = document.createElement("button");
    collapse.textContent = "⇔";
    collapse.style.cssText = `
      height: 28px; min-width: 28px;
      background:#353a40; border: 1px solid #4d535b; color: #fff;
      border-radius: 8px; cursor: pointer; padding: 0 8px; font-weight: 600;
    `;
    collapse.addEventListener("click", () => {
      bar.classList.toggle("collapsed");
      [...bar.children].forEach((c,i)=>{ if (i>1) c.style.display = bar.classList.contains("collapsed") ? "none" : ""; });
    });

    // servers dropdown
    const sel = document.createElement("select");
    sel.style.cssText = `
      height:28px; border-radius:8px; border:1px solid #4d535b;
      background:#1f2429; color:#fff; padding:0 8px; outline:none;
    `;
    (servers || []).forEach(s=>{
      const opt = document.createElement("option");
      opt.value = s.url; opt.textContent = s.name;
      sel.appendChild(opt);
    });
    const last = localStorage.getItem(LAST_SERVER_KEY);
    if (last && [...sel.options].some(o=>o.value===last)) sel.value = last;
    sel.addEventListener("change", ()=>{
      localStorage.setItem(LAST_SERVER_KEY, sel.value);
      if (sel.value) window.open(sel.value, "_blank");
    });

    // docs dropdown
    const docs = await loadDocs();
    const quick = document.createElement("select");
    quick.style.cssText = sel.style.cssText + "; min-width: 90px;";
    const placeholder = document.createElement("option");
    placeholder.value = ""; placeholder.textContent = "Docs";
    quick.appendChild(placeholder);
    docs.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d.url; opt.textContent = d.label;
      quick.appendChild(opt);
    });
    quick.addEventListener("change", ()=>{ if (quick.value) window.open(quick.value,"_blank"); quick.value=""; });

    // version pill
    const ver = document.createElement("span");
    ver.textContent = "v" + versionText;
    ver.style.cssText = `
      padding: 2px 10px; border: 1px dashed #666; border-radius: 999px;
      color: #e6e6e6; background: #1b1f24; font-size: 11px; letter-spacing: .2px;
    `;

    bar.appendChild(handle);
    bar.appendChild(collapse);
    bar.appendChild(sel);
    bar.appendChild(quick);
    bar.appendChild(ver);
    document.body.appendChild(bar);

    // handle-only drag
    (function makeDraggable(el, grip){
      let isDown=false, x=0,y=0,l=0,t=0;
      grip.addEventListener("mousedown",e=>{
        isDown = true; grip.style.cursor="grabbing";
        x=e.clientX; y=e.clientY; const r=el.getBoundingClientRect(); l=r.left; t=r.top;
        e.preventDefault();
      });
      window.addEventListener("mousemove",e=>{
        if (!isDown) return;
        el.style.left = (l + (e.clientX-x)) + "px";
        el.style.top  = (t + (e.clientY-y)) + "px";
        el.style.right = "auto"; el.style.position = "fixed";
      });
      window.addEventListener("mouseup",()=>{ if (!isDown) return; isDown=false; grip.style.cursor="grab"; });
    })(bar, handle);
  }

  // ====== CBL (player page only; refresh when profile opens)
  let cblBusy = false;
  function getInnerTextByTitle(titlePart, fallback) {
    return document.querySelector(`[title*="${titlePart}"]`)?.innerText || fallback;
  }
  function copyToClipboard(text) {
    const t = document.createElement("textarea");
    t.style.position="fixed"; t.style.opacity="0"; t.value = text;
    document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
  }
  function ensureCBLWidgets() {
    const playerPage = document.querySelector("#RCONPlayerPage");
    if (!playerPage) { removeCBLWidgets(); return; }

    if (!document.getElementById("dmh-copy-button")) {
      const copyBtn = document.createElement("button");
      copyBtn.id = "dmh-copy-button";
      copyBtn.textContent = "Copy Player Info";
      Object.assign(copyBtn.style, {
        width: "160px", height: "40px", left: "10px", top: "100px",
        position: "absolute", border: "none", cursor: "pointer", zIndex: "99999",
        fontSize: "15px", fontWeight: "700", color: "#fff",
        borderRadius: "12px 12px 0 0", background: "#2d65a5"
      });
      copyBtn.onclick = () => {
        const pSteamID = getInnerTextByTitle("765", "SteamID MISSING?");
        const pEOSID   = getInnerTextByTitle("0002", "");
        const pName    = document.querySelector("#RCONPlayerPage > h1")?.innerText || "NAME MISSING?";
        const text = `**User**: ${pName} <${window.location.href}>\n**IDs**: ${pSteamID} // ${pEOSID}\n**Server**:\n**Infraction**:\n**Evidence Linked Below**:`;
        copyToClipboard(text);
      };
      document.body.appendChild(copyBtn);
    }

    if (!document.getElementById("dmh-open-cbl")) {
      const cblBtn = document.createElement("button");
      cblBtn.id = "dmh-open-cbl";
      cblBtn.textContent = "Open CBL";
      Object.assign(cblBtn.style, {
        width: "160px", height: "28px", left: "10px", top: "140px",
        position: "absolute", border: "none", cursor: "pointer", zIndex: "99999",
        fontSize: "14px", fontWeight: "700", color: "#fff",
        borderRadius: "0 0 12px 12px", background: "#e5a411"
      });
      cblBtn.onclick = () => {
        const pSteamID = getInnerTextByTitle("765", "SteamID MISSING?");
        if (/^\d{17}$/.test(pSteamID)) window.open(`https://communitybanlist.com/search/${pSteamID}`, "_blank");
        else alert("SteamID is missing or invalid!");
      };
      document.body.appendChild(cblBtn);
    }

    if (!document.getElementById("dmh-cbl-card")) {
      const card = document.createElement("div");
      card.id = "dmh-cbl-card";
      Object.assign(card.style, {
        width: "170px", height: "125px", left: "10px", top: "175px",
        position: "absolute", zIndex: "99998", textAlign: "center",
        color: "#fff", background: "#000000bd",
        borderRadius: "12px", padding: "6px", boxShadow: "0 6px 14px rgba(0,0,0,.25)"
      });
      card.innerHTML = `<div style="font-weight:800;margin-bottom:4px">CBL Rating</div>
                        <div id="dmh-cbl-rating" style="font-size:18px;font-weight:700">—</div>
                        <div id="dmh-cbl-active"  style="font-size:12px;margin-top:6px">Active Bans: —</div>
                        <div id="dmh-cbl-expired" style="font-size:12px">Expired Bans: —</div>`;
      document.body.appendChild(card);
    }

    fetchCBLForCurrentPlayer(); // refresh on profile open
  }
  function removeCBLWidgets() {
    ["dmh-copy-button","dmh-open-cbl","dmh-cbl-card"].forEach(id => document.getElementById(id)?.remove());
  }
  function fetchCBLForCurrentPlayer() {
    if (cblBusy) return;
    const steamID = getInnerTextByTitle("765", "");
    if (!/^\d{17}$/.test(steamID)) return;
    cblBusy = true;

    const query = `query Search($id: String!) {
      steamUser(id: $id) {
        riskRating
        activeBans: bans(orderBy: "created", orderDirection: DESC, expired: false) { edges { node { id } } }
        expiredBans: bans(orderBy: "created", orderDirection: DESC, expired: true) { edges { node { id } } }
      }
    }`;

    // Use window.fetch here (works fine). If you *must* use GM_xhr, move this part to the loader.
    fetch(CBL_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id: steamID } })
    }).then(r => r.json()).then(data => {
      const user = data?.data?.steamUser;
      if (!user) throw new Error("user not found");
      const rating = user.riskRating ?? "None?";
      const active  = user.activeBans?.edges?.length ?? 0;
      const expired = user.expiredBans?.edges?.length ?? 0;
      updateCBLCard(rating, active, expired);
    }).catch(() => {
      updateCBLCard("None?", "?", "?");
    }).finally(() => { cblBusy = false; });
  }
  function updateCBLCard(rating, active, expired) {
    const ratingEl = document.getElementById("dmh-cbl-rating");
    const activeEl = document.getElementById("dmh-cbl-active");
    const expirEl  = document.getElementById("dmh-cbl-expired");
    if (!ratingEl || !activeEl || !expirEl) return;

    let color = "#fff";
    const rNum = Number(rating);
    if (!Number.isNaN(rNum)) {
      if (rNum >= 1 && rNum <= 5) color = "orange";
      if (rNum > 5) color = "red";
      ratingEl.textContent = `${rNum}/10`;
    } else {
      ratingEl.textContent = String(rating);
    }
    ratingEl.style.color = color;
    activeEl.textContent = `Active Bans: ${active}`;
    expirEl.textContent  = `Expired Bans: ${expired}`;
  }

  // ====== Observer
  function startObserving(onChange) {
    const container =
      document.querySelector(".ReactVirtualized__Grid__innerScrollContainer") ||
      document.querySelector(".css-b7r34x") ||
      document.body;

    const debounced = debounce(onChange, 100, 500);

    const obs = new MutationObserver((muts)=>{
      for (const m of muts) {
        if ((m.type === "childList" && m.addedNodes.length) || m.type === "attributes") {
          debounced(); break;
        }
      }
    });
    obs.observe(container, { childList: true, subtree: true, attributes: true });
    debounced(); // initial pass
  }

  // ====== Init
  async function init() {
    console.log("[DMH] main script loaded", VERSION);
    const [admins, servers, rules] = await Promise.all([
      loadAdmins(),
      loadServers(),
      loadRules()
    ]);

    await buildToolbar(VERSION, servers.length ? servers : [
      { name: "Server 1", url: "https://www.battlemetrics.com/rcon/servers/27157414" },
      { name: "Server 2", url: "https://www.battlemetrics.com/rcon/servers/29621932" },
      { name: "Server 3", url: "https://www.battlemetrics.com/rcon/servers/31654281" }
    ]);

    // First pass
    ensureCBLWidgets(); // on player page
    applyTimeStamps();
    applyDynamicColorRules(document, rules);
    applyAdminTags(document, admins, (rules.colors?.adminName || FALLBACK_COLORS.adminName));
    colorServerMenus();

    // Live updates
    startObserving(() => {
      applyTimeStamps();
      document.querySelectorAll(".css-ym7lu8, .css-fj458c, .css-1ewh5td")
        .forEach(n => applyAdminTags(n, admins, (rules.colors?.adminName || FALLBACK_COLORS.adminName)));
      applyDynamicColorRules(document, rules);
      colorServerMenus();
      ensureCBLWidgets();
    });
  }

  window.addEventListener("load", init);
})();
