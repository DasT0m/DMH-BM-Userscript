// ==UserScript==
// @name         DMH_BM_Script_Overlay
// @namespace    DMH
// @version      1.0.0
// @description  Overlay for BM logs with admin highlights, servers, coloring rules, draggable + collapsible toolbar. Optimized with MutationObserver + debounced updates.
// @match        https://www.battlemetrics.com/rcon/servers/*/logs*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
  "use strict";

  const ADMIN_URL  = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/admins.json";
  const SERVER_URL = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/servers.json";
  const COLOR_URL  = "https://raw.githubusercontent.com/DasT0m/DMH-BM-Userscript/main/color-rules.json";

  const CACHE_TTL = 1000 * 60 * 60; // 1h
  const lastKey   = "dmh_last_server_id";

  /** Debounce helper */
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

  /** Fetch JSON with cache + fallback */
  async function fetchJSON(url, key) {
    const cached = GM_getValue(key, null);
    const cachedTime = GM_getValue(key + "_time", 0);

    if (cached && Date.now() - cachedTime < CACHE_TTL) {
      return cached;
    }

    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(resp.status);
      const data = await resp.json();
      GM_setValue(key, data);
      GM_setValue(key + "_time", Date.now());
      return data;
    } catch (e) {
      console.warn("Fallback to cache for", key, e);
      return cached || null;
    }
  }

  /** Toolbar */
  function buildToolbar(versionText, servers) {
    let old = document.getElementById("dmh-toolbar");
    if (old) old.remove();

    const bar = document.createElement("div");
    bar.id = "dmh-toolbar";
    bar.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      display: flex; align-items: center; gap: 6px;
      background:#111a; backdrop-filter: blur(4px);
      padding: 4px 6px; border-radius: 10px;
      font-family: system-ui,sans-serif; z-index: 99999;
    `;

    // collapse button
    const collapse = document.createElement("button");
    collapse.textContent = "⇔";
    collapse.style.cssText = `
      background:#333; border:none; color:#fff;
      border-radius:4px; cursor:pointer; padding:2px 6px;
    `;
    collapse.addEventListener("click", () => {
      bar.classList.toggle("collapsed");
      if (bar.classList.contains("collapsed")) {
        [...bar.children].forEach((c,i) => { if (i>0) c.style.display="none"; });
      } else {
        [...bar.children].forEach(c => c.style.display="");
      }
    });

    // server select (auto-open)
    const sel = document.createElement("select");
    sel.style.cssText = `
      height:24px; border-radius:6px; border:1px solid #444;
      background:#222; color:#fff; padding:0 6px;
    `;
    servers.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.url;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
    const last = localStorage.getItem(lastKey);
    if (last && [...sel.options].some(o => o.value === last)) sel.value = last;
    sel.addEventListener("change", () => {
      localStorage.setItem(lastKey, sel.value);
      if (sel.value) window.open(sel.value, "_blank");
    });

    // docs quick dropdown
    const quick = document.createElement("select");
    quick.style.cssText = `
      height:24px; border-radius:6px; border:1px solid #444;
      background:#222; color:#fff; padding:0 6px;
    `;
    [["","Docs"],["https://example.com/sop","SOP"],["https://example.com/msg","MSG"],["https://example.com/rul","RUL"]]
      .forEach(([url,label])=>{
        const opt = document.createElement("option");
        opt.value = url; opt.textContent = label; quick.appendChild(opt);
      });
    quick.addEventListener("change", () => {
      if (quick.value) window.open(quick.value,"_blank");
      quick.value="";
    });

    // version label
    const ver = document.createElement("span");
    ver.textContent = "v" + versionText;
    ver.style.cssText = `
      padding:2px 8px; border:1px dashed #666; border-radius:999px;
      color:#ddd; background:#222; font-size:11px;
    `;

    bar.appendChild(collapse);
    bar.appendChild(sel);
    bar.appendChild(quick);
    bar.appendChild(ver);
    document.body.appendChild(bar);

    makeDraggable(bar);
  }

  /** Drag helper */
  function makeDraggable(el) {
    let pos1=0,pos2=0,pos3=0,pos4=0;
    el.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
      e.preventDefault(); pos3=e.clientX; pos4=e.clientY;
      document.onmouseup=closeDrag; document.onmousemove=drag;
    }
    function drag(e){
      e.preventDefault();
      pos1=pos3-e.clientX; pos2=pos4-e.clientY;
      pos3=e.clientX; pos4=e.clientY;
      el.style.top=(el.offsetTop-pos2)+"px";
      el.style.left=(el.offsetLeft-pos1)+"px";
    }
    function closeDrag(){ document.onmouseup=null; document.onmousemove=null; }
  }

  /** Apply highlights */
  function applyColors(node, admins, rules) {
    if (!node.innerText) return;
    const text=node.innerText;
    // admin check
    if (admins && admins.admins && admins.admins.some(a=> new RegExp(`\\b${a}\\b`,"i").test(text))) {
      node.style.color="orange"; node.innerText+=" 🛡️";
    }
    // rules
    if (rules && rules.rules) {
      for (let r of rules.rules) {
        if (new RegExp(r.pattern,"i").test(text)) {
          node.style.color=r.color;
          break;
        }
      }
    }
  }

  /** Init */
  async function init() {
    const [admins, servers, rules] = await Promise.all([
      fetchJSON(ADMIN_URL,"admins"),
      fetchJSON(SERVER_URL,"servers"),
      fetchJSON(COLOR_URL,"colors")
    ]);
    buildToolbar("1.0.0", servers?.servers || [{name:"Server1",url:"#"}]);

    const target=document.querySelector("#server-log div");
    if (!target) return;

    const debounced = debounce(muts=>{
      muts.forEach(m=>{
        m.addedNodes.forEach(n=>{
          if(n.nodeType===1) applyColors(n, admins, rules);
        });
      });
    });

    const obs=new MutationObserver(debounced);
    obs.observe(target,{childList:true,subtree:true});
  }

  window.addEventListener("load",init);
})();
