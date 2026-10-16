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
      row.innerHTML = `<input type="checkbox" ${it.done ? "checked" : ""} aria-label="Fatto"><span></span><button aria-label="Elimina">🗑</button>`;
      row.querySelector("span").textContent = it.text;
      row.querySelector("input").addEventListener("change", (e) => { it.done = e.target.checked; save(); renderSlots(); renderAll(); });
      row.querySelector("button").addEventListener("click", () => removeItem(s.id, it.id));
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
