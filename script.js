/* ===========================
   WeekWise — Timetable
   - Pure HTML/CSS/JS
   - LocalStorage: WEEKWISE_SLOTS
   - Modal-based editing
   - Current day + hour highlight
   =========================== */

const STORAGE_KEY = "WEEKWISE_SLOTS_V2";

// Order matches JS Date().getDay(): 0=Sun..6=Sat
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function isWeekend(dayName){
  return dayName === "Saturday" || dayName === "Sunday";
}

function buildHoursForDay(dayName){
  // Mon–Fri: 20..23 (8 PM to 12 AM)
  // Sat–Sun: 8..23 (8 AM to 12 AM)
  const start = isWeekend(dayName) ? 8 : 20;
  const end = 24; // exclusive
  const hours = [];
  for(let h=start; h<end; h++) hours.push(h);
  return hours;
}

function hourToLabel(h){
  // 0..23 -> label
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = (h % 12) === 0 ? 12 : (h % 12);
  return `${hour12}:00 ${suffix}`;
}

function slotId(dayName, hour){
  return `${dayName}__${hour}`;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/* ===== Data Model =====
slots = {
  "Monday__20": { type:"study|essential|nonessential|empty", title:"", notes:"" },
  ...
}
*/
function defaultSlot(){
  return { type: "empty", title: "", notes: "" };
}

function loadSlots(){
  // Migration: if old key exists (weekwise innerHTML), ignore and start clean
  // because V2 is structured. You can extend migration later if needed.
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return {};
  try{
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  }catch{
    return {};
  }
}

function saveSlots(slots){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

let slots = loadSlots();

/* ===== Intro Typewriter ===== */
const intro = document.getElementById("intro");
const typeEl = document.getElementById("typeText");
const introText = "Your week. One page. Zero excuses.";
let t = 0;

function runTypewriter(){
  if(!typeEl) return;
  const tick = () => {
    if(t < introText.length){
      typeEl.textContent += introText.charAt(t);
      t++;
      setTimeout(tick, 40);
    }else{
      // auto close after short beat
      setTimeout(() => {
        if(intro) intro.style.display = "none";
      }, 650);
    }
  };
  tick();
}
runTypewriter();

/* ===== Render Timetable ===== */
const timetable = document.getElementById("timetable");

function render(){
  if(!timetable) return;
  timetable.innerHTML = "";

  const now = new Date();
  const currentDayName = DAYS[now.getDay()];
  const currentHour = now.getHours(); // 0..23

  // Monday..Sunday in your preference layout:
  const displayDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  displayDays.forEach((dayName, idx) => {
    const dayWrap = document.createElement("div");
    dayWrap.className = "day" + (dayName === currentDayName ? " current-day" : "");

    const head = document.createElement("div");
    head.className = "day-head";

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = dayName;

    const sub = document.createElement("div");
    sub.className = "day-sub";
    sub.textContent = isWeekend(dayName) ? "8 AM — 12 AM" : "8 PM — 12 AM";

    head.appendChild(title);
    head.appendChild(sub);

    const grid = document.createElement("div");
    grid.className = "slots";

    const hours = buildHoursForDay(dayName);

    hours.forEach(hour => {
      const id = slotId(dayName, hour);
      const data = slots[id] || defaultSlot();

      const slot = document.createElement("div");
      slot.className = "slot " + (data.type || "empty");
      if(dayName === currentDayName && hour === currentHour){
        slot.classList.add("now");
      }

      slot.dataset.day = dayName;
      slot.dataset.hour = String(hour);

      const time = document.createElement("div");
      time.className = "slot-time";
      time.textContent = hourToLabel(hour);

      const stitle = document.createElement("div");
      stitle.className = "slot-title";
      stitle.textContent = data.title ? data.title : (data.type === "empty" ? "Tap to add" : "—");

      const note = document.createElement("div");
      note.className = "slot-note";
      note.textContent = data.notes ? data.notes : "";

      slot.appendChild(time);
      slot.appendChild(stitle);
      slot.appendChild(note);

      slot.addEventListener("click", () => openModal(dayName, hour));
      grid.appendChild(slot);
    });

    dayWrap.appendChild(head);
    dayWrap.appendChild(grid);
    timetable.appendChild(dayWrap);

    // stagger animation
    dayWrap.style.animationDelay = `${idx * 55}ms`;
  });
}

/* ===== Modal Controls ===== */
const overlay = document.getElementById("modalOverlay");
const btnClose = document.getElementById("btnCloseModal");
const btnCancel = document.getElementById("btnCancel");
const btnSave = document.getElementById("btnSave");
const btnDelete = document.getElementById("btnDeleteSlot");

const modalMeta = document.getElementById("modalMeta");
const typeSelect = document.getElementById("slotType");
const titleInput = document.getElementById("slotTitle");
const notesInput = document.getElementById("slotNotes");

let activeDay = null;
let activeHour = null;

function openModal(dayName, hour){
  activeDay = dayName;
  activeHour = hour;

  const id = slotId(dayName, hour);
  const data = slots[id] || defaultSlot();

  modalMeta.textContent = `${dayName} • ${hourToLabel(hour)}`;
  typeSelect.value = data.type || "empty";
  titleInput.value = data.title || "";
  notesInput.value = data.notes || "";

  overlay.classList.remove("hidden");
}

function closeModal(){
  overlay.classList.add("hidden");
  activeDay = null;
  activeHour = null;
}

btnClose?.addEventListener("click", closeModal);
btnCancel?.addEventListener("click", closeModal);
overlay?.addEventListener("click", (e) => {
  if(e.target === overlay) closeModal();
});

function setSlot(dayName, hour, payload){
  const id = slotId(dayName, hour);
  slots[id] = payload;
  saveSlots(slots);
  render();
}

btnSave?.addEventListener("click", () => {
  if(activeDay == null || activeHour == null) return;

  const chosen = typeSelect.value;
  const payload = {
    type: chosen,
    title: titleInput.value.trim(),
    notes: notesInput.value.trim()
  };

  // if empty and no content, store as empty
  if(payload.type === "empty" && !payload.title && !payload.notes){
    delete slots[slotId(activeDay, activeHour)];
    saveSlots(slots);
    render();
    closeModal();
    return;
  }

  setSlot(activeDay, activeHour, payload);
  closeModal();
});

btnDelete?.addEventListener("click", () => {
  if(activeDay == null || activeHour == null) return;
  delete slots[slotId(activeDay, activeHour)];
  saveSlots(slots);
  render();
  closeModal();
});

/* ===== Clear All ===== */
document.getElementById("btnClearAll")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  slots = {};
  render();
});

/* ===== Live “Now” refresh ===== */
render();
setInterval(render, 60 * 1000); // update highlight each minute