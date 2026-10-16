const STORAGE_KEY = "calendario-montaggio-v1";
const SLOTS = [
  { id: "mattino", label: "🌅 Mattino" },
  { id: "pomeriggio", label: "☀️ Pomeriggio" },
  { id: "sera", label: "🌙 Sera" },
];
const MAX_PREVIEW = 4;

// data: { "YYYY-MM-DD": { mattino: [{id, text, done}], pomeriggio: [], sera: [] } }
let data = load();
let view = new Date();
view.setDate(1);
let openDate = null;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function entries(k) {
  const day = data[k] || {};
  return SLOTS.flatMap((s) => (day[s.id] || []).map((it) => ({ ...it, slot: s.id })));
}

function chip(it) {
  const el = document.createElement("div");
  el.className = `chip ${it.slot}${it.done ? " done" : ""}`;
  el.textContent = it.text;
  el.title = it.text;
  return el;
}

function renderCalendar() {
  $("monthLabel").textContent = view.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const grid = $("days");
  grid.innerHTML = "";
  const offset = (view.getDay() + 6) % 7; // lunedì = 0
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - offset);
  const todayK = key(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i >= 35 && d.getMonth() !== view.getMonth()) break;
    const k = key(d);
    const cell = document.createElement("div");
    cell.className = "day" + (d.getMonth() !== view.getMonth() ? " other" : "") + (k === todayK ? " today" : "");
    cell.innerHTML = `<div class="num">${d.getDate()}</div>`;
    const list = entries(k);
    list.slice(0, MAX_PREVIEW).forEach((it) => cell.appendChild(chip(it)));
    if (list.length > MAX_PREVIEW) {
      const more = document.createElement("div");
      more.className = "more";
      more.textContent = `+${list.length - MAX_PREVIEW} altri`;
      cell.appendChild(more);
    }
    cell.addEventListener("click", () => openDay(k));
    grid.appendChild(cell);
  }
}

function renderUpcoming() {
  const box = $("upcomingList");
  box.innerHTML = "";
  const todayK = key(new Date());
  const keys = Object.keys(data).filter((k) => k >= todayK && entries(k).length).sort().slice(0, 7);
  if (!keys.length) {
    box.innerHTML = `<p class="empty">Niente in programma. Clicca un giorno per aggiungere un montaggio.</p>`;
    return;
  }
  keys.forEach((k) => {
    const row = document.createElement("div");
    row.className = "up-day";
    const label = fromKey(k).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    row.innerHTML = `<strong>${label}</strong>`;
    entries(k).forEach((it) => {
      const c = chip(it);
      c.textContent = `${SLOTS.find((s) => s.id === it.slot).label} — ${it.text}`;
      row.appendChild(c);
    });
    row.addEventListener("click", () => openDay(k));
    box.appendChild(row);
  });
}

function renderAll() { renderCalendar(); renderUpcoming(); }

function openDay(k) {
  openDate = k;
  $("dayTitle").textContent = fromKey(k).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  renderSlots();
  if (!$("dayDialog").open) $("dayDialog").showModal();
}

function renderSlots() {
  const wrap = $("slots");
  wrap.innerHTML = "";
  const day = data[openDate] || {};
  SLOTS.forEach((s) => {
    const sec = document.createElement("div");
    sec.className = `slot ${s.id}`;
    sec.innerHTML = `<h3>${s.label}</h3>`;
    (day[s.id] || []).forEach((it) => {
      const row = document.createElement("div");
      row.className = "item" + (it.done ? " done" : "");
      row.innerHTML = `<input type="checkbox" ${it.done ? "checked" : ""} aria-label="Fatto"><span></span><button class="edit" aria-label="Modifica">✏️</button><button class="del" aria-label="Elimina">🗑</button>`;
      row.querySelector("span").textContent = it.text;
      row.querySelector("span").addEventListener("click", () => editItem(row, it));
      row.querySelector(".edit").addEventListener("click", () => editItem(row, it));
      row.querySelector("input").addEventListener("change", (e) => { it.done = e.target.checked; save(); renderSlots(); renderAll(); });
      row.querySelector(".del").addEventListener("click", () => removeItem(s.id, it.id));
      sec.appendChild(row);
    });
    const form = document.createElement("form");
    form.className = "add";
    form.innerHTML = `<input placeholder="es. Step Puglia puntata 3" required><button>Aggiungi</button>`;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      addItem(s.id, input.value.trim());
    });
    sec.appendChild(form);
    wrap.appendChild(sec);
  });
}

function editItem(row, it) {
  const span = row.querySelector("span");
  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = it.text;
  span.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (commit && v) { it.text = v; save(); }
    renderSlots(); renderAll();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

function addItem(slot, text) {
  if (!text) return;
  const day = (data[openDate] ||= {});
  (day[slot] ||= []).push({ id: Date.now() + Math.random(), text, done: false });
  save(); renderSlots(); renderAll();
  const inputs = $("slots").querySelectorAll(".slot");
  inputs[SLOTS.findIndex((s) => s.id === slot)].querySelector("input").focus();
}

function removeItem(slot, id) {
  const day = data[openDate];
  day[slot] = day[slot].filter((it) => it.id !== id);
  if (SLOTS.every((s) => !(day[s.id] || []).length)) delete data[openDate];
  save(); renderSlots(); renderAll();
}

$("prev").addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderAll(); });
$("next").addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderAll(); });
$("today").addEventListener("click", () => { view = new Date(); view.setDate(1); renderAll(); });
$("dayDialog").addEventListener("click", (e) => { if (e.target === $("dayDialog")) $("dayDialog").close(); });

$("exportBtn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `calendario-montaggio-${key(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    if (confirm("Sostituire i dati attuali con il backup?")) { data = parsed; save(); renderAll(); }
  } catch { alert("File non valido."); }
  e.target.value = "";
});

$("weekdays").innerHTML = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => `<div>${d}</div>`).join("");
renderAll();

// ---------- Sincronizzazione via GitHub Gist ----------
const CFG_KEY = "calendario-montaggio-sync";
const GIST_FILE = "calendario-montaggio.json";
const cfg = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } })();
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} };

function status(msg, err) {
  const el = $("syncStatus");
  el.textContent = msg;
  el.className = "status" + (err ? " err" : "");
}

async function gh(path, opts = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...opts,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Token non valido" : res.status === 404 ? "Gist non trovato" : `Errore GitHub ${res.status}`);
  return res.json();
}

async function findGist() {
  if (cfg.gistId) return cfg.gistId;
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files && g.files[GIST_FILE]);
    if (hit) { cfg.gistId = hit.id; saveCfg(); return hit.id; }
    if (list.length < 100) break;
  }
  return null;
}

function needToken() {
  if (cfg.token) return false;
  status("Imposta prima il token (⚙️)", true);
  $("settingsDialog").showModal();
  return true;
}

async function pull() {
  if (needToken()) return;
  try {
    status("Pull in corso…");
    const id = await findGist();
    if (!id) return status("Nessun Gist trovato: fai prima un Push", true);
    const g = await gh(`/gists/${id}`);
    const f = g.files[GIST_FILE];
    if (!f) throw new Error("File non presente nel Gist");
    const content = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    const remote = JSON.parse(content);
    if (!confirm("Sostituire i dati locali con quelli scaricati?")) return status("Pull annullato");
    data = remote; save(); renderAll();
    status("Pull completato " + new Date().toLocaleTimeString("it-IT"));
  } catch (e) { status(e.message, true); }
}

async function push() {
  if (needToken()) return;
  try {
    status("Push in corso…");
    const body = { files: { [GIST_FILE]: { content: JSON.stringify(data, null, 2) } } };
    const id = await findGist();
    if (id) await gh(`/gists/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    else {
      const g = await gh("/gists", { method: "POST", body: JSON.stringify({ description: "Calendario montaggio podcast", public: false, ...body }) });
      cfg.gistId = g.id; saveCfg();
    }
    status("Push completato " + new Date().toLocaleTimeString("it-IT"));
  } catch (e) { status(e.message, true); }
}

$("pullBtn").addEventListener("click", pull);
$("pushBtn").addEventListener("click", push);
$("settingsBtn").addEventListener("click", () => {
  $("tokenInput").value = cfg.token || "";
  $("gistInput").value = cfg.gistId || "";
  $("settingsDialog").showModal();
});
$("saveSettings").addEventListener("click", (e) => {
  e.preventDefault();
  cfg.token = $("tokenInput").value.trim();
  cfg.gistId = $("gistInput").value.trim();
  saveCfg();
  $("settingsDialog").close();
  status("Impostazioni salvate");
});
$("clearSettings").addEventListener("click", (e) => {
  e.preventDefault();
  delete cfg.token; delete cfg.gistId; saveCfg();
  $("tokenInput").value = ""; $("gistInput").value = "";
  status("Token rimosso");
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
