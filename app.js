const STORAGE_KEY = "calendario-montaggio-v1";
const SLOTS = [
  { id: "mattino", label: "🌅 Mattino" },
  { id: "pomeriggio", label: "☀️ Pomeriggio" },
  { id: "sera", label: "🌙 Sera" },
];
const MAX_PREVIEW = 4;

const TAGS_KEY = "calendario-montaggio-tags-v1";
const TAG_COLORS = ["#e5484d", "#f5a524", "#30a46c", "#17a2b8", "#5b5bd6", "#8e5bd6", "#d6409f", "#8b8d98"];

// data: { "YYYY-MM-DD": { mattino: [{id, text, done}], pomeriggio: [], sera: [], tags: { mattino: [tagId], ... } } }
// tags: [{ id, name, color, notes }]  (la legenda: indicazioni di montaggio per progetto/cliente)
let data = load();
let tags = loadTags();
const HIDE_KEY = "calendario-montaggio-hide";
let hideNames = (() => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } })();
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
function loadTags() {
  try { const t = JSON.parse(localStorage.getItem(TAGS_KEY)); return Array.isArray(t) ? t : []; } catch { return []; }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch {}
}

// Formato di backup/sync: giorni + legenda. I vecchi backup (solo giorni) restano leggibili.
const payload = () => ({ version: 2, days: data, tags });
function applyPayload(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Formato non valido");
  if (p.version === 2 && p.days && typeof p.days === "object") {
    data = p.days;
    tags = Array.isArray(p.tags) ? p.tags : [];
  } else data = p;
  save(); renderAll();
}

const tagById = (id) => tags.find((t) => t.id === id);
const slotTags = (k, slotId) => (((data[k] || {}).tags || {})[slotId] || []).map(tagById).filter(Boolean);
const hasContent = (k) => entries(k).length > 0;

function entries(k) {
  const day = data[k] || {};
  return SLOTS.flatMap((s) => [
    ...slotTags(k, s.id).map((tag) => ({ kind: "tag", tag, slot: s.id })),
    ...(day[s.id] || []).map((it) => ({ ...it, kind: "item", slot: s.id })),
  ]);
}

function pruneDay(k) {
  const day = data[k];
  if (!day) return;
  const emptyTags = SLOTS.every((s) => !((day.tags || {})[s.id] || []).length);
  if (emptyTags && SLOTS.every((s) => !(day[s.id] || []).length)) delete data[k];
}

function chip(it) {
  const el = document.createElement("div");
  if (it.kind === "tag") {
    el.className = "chip tag";
    el.style.setProperty("--tc", it.tag.color);
    el.textContent = it.tag.name;
    el.title = it.tag.name;
    return el;
  }
  el.className = `chip ${it.slot}${it.done ? " done" : ""}`;
  el.textContent = it.text;
  el.title = it.text;
  return el;
}

// Indicazioni di montaggio di un tag: ridotte a poche righe, con "Mostra tutto".
function notesBlock(tag) {
  const wrap = document.createElement("div");
  wrap.className = "notes";
  wrap.style.setProperty("--tc", tag.color);
  const notes = (tag.notes || "").trim();
  const title = document.createElement("strong");
  title.textContent = `📋 ${tag.name}`;
  wrap.appendChild(title);
  const body = document.createElement("div");
  body.className = "notes-body clamp";
  body.textContent = notes || "Nessuna indicazione (aggiungila dalla Legenda).";
  wrap.appendChild(body);
  if (notes.length > 90 || notes.split("\n").length > 2) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link";
    btn.textContent = "Mostra tutto";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = body.classList.toggle("clamp");
      btn.textContent = open ? "Mostra tutto" : "Mostra meno";
    });
    wrap.appendChild(btn);
  }
  return wrap;
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
    const list = entries(k).filter((it) => it.kind === "item");
    list.slice(0, MAX_PREVIEW).forEach((it) => {
      const c = chip(it);
      if (hideNames) { c.textContent = "🎙"; c.title = ""; c.classList.add("mic"); }
      cell.appendChild(c);
    });
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
  const keys = Object.keys(data).filter((k) => k >= todayK && hasContent(k)).sort().slice(0, 7);
  if (!keys.length) {
    box.innerHTML = `<p class="empty">Niente in programma. Clicca un giorno per aggiungere un montaggio.</p>`;
    return;
  }
  keys.forEach((k) => {
    const row = document.createElement("div");
    row.className = "up-day";
    const label = fromKey(k).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    row.innerHTML = `<strong>${label}</strong>`;
    SLOTS.forEach((s) => {
      const list = entries(k).filter((it) => it.slot === s.id);
      if (!list.length) return;
      const h = document.createElement("div");
      h.className = "up-slot";
      h.textContent = s.label;
      row.appendChild(h);
      list.forEach((it) => row.appendChild(chip(it)));
      slotTags(k, s.id).forEach((tag) => row.appendChild(notesBlock(tag)));
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
    const active = ((day.tags || {})[s.id] || []);
    const picker = document.createElement("div");
    picker.className = "picker";
    if (!tags.length) {
      picker.innerHTML = `<span class="empty">Nessun tag: creali dalla 🏷 Legenda.</span>`;
    }
    tags.forEach((tag) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill" + (active.includes(tag.id) ? " on" : "");
      b.style.setProperty("--tc", tag.color);
      b.textContent = tag.name;
      b.addEventListener("click", () => toggleSlotTag(s.id, tag.id));
      picker.appendChild(b);
    });
    sec.appendChild(picker);
    slotTags(openDate, s.id).forEach((tag) => sec.appendChild(notesBlock(tag)));
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
  pruneDay(openDate);
  save(); renderSlots(); renderAll();
}

function toggleSlotTag(slot, tagId) {
  const day = (data[openDate] ||= {});
  const map = (day.tags ||= {});
  const list = (map[slot] ||= []);
  const i = list.indexOf(tagId);
  if (i >= 0) list.splice(i, 1); else list.push(tagId);
  pruneDay(openDate);
  save(); renderSlots(); renderAll();
}

// ---------- Legenda dei tag ----------
let editingTag = null;

function renderTags() {
  const box = $("tagsList");
  box.innerHTML = "";
  if (!tags.length) box.innerHTML = `<p class="empty">Ancora nessun tag. Creane uno per ogni podcast o cliente.</p>`;
  tags.forEach((tag) => {
    const card = document.createElement("div");
    card.className = "tag-card";
    card.style.setProperty("--tc", tag.color);

    if (editingTag !== tag.id) {
      card.classList.add("compact");
      card.innerHTML = `<div class="tag-row"><strong class="tag-title"></strong><button type="button" class="edit" aria-label="Modifica tag">✏️ Modifica</button></div><div class="tag-preview"></div>`;
      card.querySelector(".tag-title").textContent = tag.name;
      card.querySelector(".tag-preview").textContent = (tag.notes || "").trim() || "Nessuna indicazione.";
      card.querySelector(".edit").addEventListener("click", () => { editingTag = tag.id; renderTags(); });
      box.appendChild(card);
      return;
    }

    card.innerHTML = `<div class="tag-row"><input type="color" aria-label="Colore"><input class="tag-name" placeholder="Nome (es. Marchesano)"><button type="button" class="del" aria-label="Elimina tag">🗑</button></div><textarea rows="5" placeholder="Indicazioni di montaggio: stile, musiche, formato, cose da ricordare…"></textarea><div class="add"><button type="button" class="ok">✓ OK</button></div>`;
    const [color, name] = card.querySelectorAll("input");
    const notes = card.querySelector("textarea");
    color.value = tag.color;
    name.value = tag.name;
    notes.value = tag.notes || "";
    color.addEventListener("input", () => { card.style.setProperty("--tc", color.value); });
    card.querySelector(".ok").addEventListener("click", () => {
      tag.color = color.value;
      tag.name = name.value.trim() || "Senza nome";
      tag.notes = notes.value;
      editingTag = null;
      save(); renderTags(); renderAll();
    });
    card.querySelector(".del").addEventListener("click", () => {
      if (!confirm(`Eliminare il tag "${tag.name}"? Sparirà anche dai giorni in cui l'hai usato.`)) return;
      tags = tags.filter((t) => t !== tag);
      editingTag = null;
      save(); renderTags(); renderAll();
    });
    box.appendChild(card);
  });
}

function syncEye() {
  const b = $("eyeBtn");
  b.classList.toggle("off", hideNames);
  b.setAttribute("aria-pressed", String(hideNames));
  b.title = hideNames ? "Mostra i nomi nel calendario" : "Nascondi i nomi nel calendario";
}
$("eyeBtn").addEventListener("click", () => {
  hideNames = !hideNames;
  try { localStorage.setItem(HIDE_KEY, hideNames ? "1" : "0"); } catch {}
  syncEye(); renderCalendar();
});
syncEye();

$("tagsBtn").addEventListener("click", () => { editingTag = null; renderTags(); $("tagsDialog").showModal(); });
$("addTag").addEventListener("click", () => {
  const tag = { id: String(Date.now()), name: "Nuovo tag", color: TAG_COLORS[tags.length % TAG_COLORS.length], notes: "" };
  tags.push(tag);
  editingTag = tag.id;
  save(); renderTags(); renderAll();
  const names = $("tagsList").querySelectorAll(".tag-name");
  const last = names[names.length - 1];
  last.focus(); last.select();
});
$("tagsDialog").addEventListener("close", renderAll);

$("prev").addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderAll(); });
$("next").addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderAll(); });
$("today").addEventListener("click", () => { view = new Date(); view.setDate(1); renderAll(); });
$("dayDialog").addEventListener("click", (e) => { if (e.target === $("dayDialog")) $("dayDialog").close(); });

$("exportBtn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" }));
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
    if (confirm("Sostituire i dati attuali con il backup?")) applyPayload(parsed);
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
    applyPayload(remote);
    status("Pull completato " + new Date().toLocaleTimeString("it-IT"));
  } catch (e) { status(e.message, true); }
}

async function push() {
  if (needToken()) return;
  try {
    status("Push in corso…");
    const body = { files: { [GIST_FILE]: { content: JSON.stringify(payload(), null, 2) } } };
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
