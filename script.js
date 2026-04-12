/* ===========================
   WeekWise — Timetable (Updated)
   Features:
   - Dynamic reusable tags with custom colors
   - Multiple tags per slot
   - Global edit/delete tags
   - Multi-select top filters (AND logic)
   - Recurring/copy by similar days
   - Weekly analytics dashboard
   - Legacy V2 migration supported
   - All days now use 12 AM to 11 PM
   =========================== */

const STORAGE_KEY_V3 = "WEEKWISE_DATA_V3";
const LEGACY_KEY_V2 = "WEEKWISE_SLOTS_V2";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DISPLAY_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const LEGACY_TYPE_MAP = {
  study: { name: "Study", color: "#baf3c0" },
  essential: { name: "Essential Break", color: "#fff1a8" },
  nonessential: { name: "Non-Essential Break", color: "#ffb4b4" }
};

function isWeekend(dayName){
  return dayName === "Saturday" || dayName === "Sunday";
}

function buildHoursForDay(dayName){
  const hours = [];
  for(let h = 0; h < 24; h++) hours.push(h);
  return hours;
}

function hourToLabel(h){
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = (h % 12) === 0 ? 12 : (h % 12);
  return `${hour12}:00 ${suffix}`;
}

function slotId(dayName, hour){
  return `${dayName}__${hour}`;
}

function normalizeTagName(name){
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeTagKey(name){
  return normalizeTagName(name).toLowerCase();
}

function sanitizeColor(color){
  const c = String(color || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(c) ? c : "#cccccc";
}

function uniqueArray(arr){
  return [...new Set(arr)];
}

function defaultSlot(){
  return {
    title: "",
    notes: "",
    tagIds: []
  };
}

function generateTagId(name){
  const cleaned = normalizeTagKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `tag-${Date.now()}`;
}

/* ===== Data ===== */
function migrateLegacyData(){
  const raw = localStorage.getItem(LEGACY_KEY_V2);
  if(!raw) return { tags: {}, slots: {} };

  let oldSlots = {};
  try{
    oldSlots = JSON.parse(raw) || {};
  }catch{
    oldSlots = {};
  }

  const tags = {};
  const slots = {};

  Object.entries(oldSlots).forEach(([id, value]) => {
    const old = value || {};
    const slot = defaultSlot();
    slot.title = String(old.title || "").trim();
    slot.notes = String(old.notes || "").trim();

    if(old.type && LEGACY_TYPE_MAP[old.type] && old.type !== "empty"){
      const legacyTag = LEGACY_TYPE_MAP[old.type];
      const tagId = generateTagId(legacyTag.name);

      if(!tags[tagId]){
        tags[tagId] = {
          id: tagId,
          name: legacyTag.name,
          color: legacyTag.color
        };
      }

      slot.tagIds.push(tagId);
    }

    if(slot.title || slot.notes || slot.tagIds.length){
      slots[id] = {
        title: slot.title,
        notes: slot.notes,
        tagIds: uniqueArray(slot.tagIds)
      };
    }
  });

  return { tags, slots };
}

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY_V3);
  if(raw){
    try{
      const parsed = JSON.parse(raw);
      if(parsed && typeof parsed === "object"){
        return {
          tags: parsed.tags && typeof parsed.tags === "object" ? parsed.tags : {},
          slots: parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {}
        };
      }
    }catch{}
  }

  const migrated = migrateLegacyData();
  localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(migrated));
  return migrated;
}

function saveData(){
  localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(appData));
}

let appData = loadData();
let activeFilters = [];

/* ===== DOM ===== */
const intro = document.getElementById("intro");
const typeEl = document.getElementById("typeText");

const timetable = document.getElementById("timetable");
const tagFilters = document.getElementById("tagFilters");
const filtersSubText = document.getElementById("filtersSubText");

const statsGrid = document.getElementById("statsGrid");
const tagBreakdown = document.getElementById("tagBreakdown");
const dayBreakdown = document.getElementById("dayBreakdown");

const overlay = document.getElementById("modalOverlay");
const btnClose = document.getElementById("btnCloseModal");
const btnCancel = document.getElementById("btnCancel");
const btnSave = document.getElementById("btnSave");
const btnDelete = document.getElementById("btnDeleteSlot");
const btnAddTag = document.getElementById("btnAddTag");

const modalMeta = document.getElementById("modalMeta");
const titleInput = document.getElementById("slotTitle");
const notesInput = document.getElementById("slotNotes");
const availableTagsEl = document.getElementById("availableTags");
const selectedTagsPreview = document.getElementById("selectedTagsPreview");
const newTagNameInput = document.getElementById("newTagName");
const newTagColorInput = document.getElementById("newTagColor");
const applyScopeSelect = document.getElementById("applyScope");

const tagManagerOverlay = document.getElementById("tagManagerOverlay");
const btnManageTags = document.getElementById("btnManageTags");
const btnCloseTagManager = document.getElementById("btnCloseTagManager");
const btnCloseTagManager2 = document.getElementById("btnCloseTagManager2");
const tagManagerList = document.getElementById("tagManagerList");

let activeDay = null;
let activeHour = null;
let modalSelectedTagIds = [];

/* ===== Intro ===== */
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
      setTimeout(() => {
        if(intro) intro.style.display = "none";
      }, 650);
    }
  };
  tick();
}
runTypewriter();

/* ===== Helpers ===== */
function getTagsArray(){
  return Object.values(appData.tags).sort((a, b) => a.name.localeCompare(b.name));
}

function getTagById(tagId){
  return appData.tags[tagId] || null;
}

function findTagByName(name){
  const key = normalizeTagKey(name);
  return getTagsArray().find(tag => normalizeTagKey(tag.name) === key) || null;
}

function getOrCreateTag(name, color){
  const cleanName = normalizeTagName(name);
  if(!cleanName) return null;

  const existing = findTagByName(cleanName);
  if(existing) return existing;

  let tagId = generateTagId(cleanName);
  let counter = 1;
  while(appData.tags[tagId]){
    counter += 1;
    tagId = `${generateTagId(cleanName)}-${counter}`;
  }

  const tag = {
    id: tagId,
    name: cleanName,
    color: sanitizeColor(color)
  };

  appData.tags[tagId] = tag;
  saveData();
  return tag;
}

function renameOrUpdateTag(tagId, newName, newColor){
  const tag = getTagById(tagId);
  if(!tag) return { ok:false, message:"Tag not found" };

  const cleanName = normalizeTagName(newName);
  const cleanColor = sanitizeColor(newColor);

  if(!cleanName) return { ok:false, message:"Tag name cannot be empty" };

  const duplicate = getTagsArray().find(t =>
    t.id !== tagId && normalizeTagKey(t.name) === normalizeTagKey(cleanName)
  );

  if(duplicate){
    return { ok:false, message:"Another tag with this name already exists" };
  }

  tag.name = cleanName;
  tag.color = cleanColor;
  saveData();
  return { ok:true };
}

function deleteTagGlobally(tagId){
  if(!appData.tags[tagId]) return;

  delete appData.tags[tagId];

  Object.keys(appData.slots).forEach(id => {
    const slot = appData.slots[id];
    slot.tagIds = (slot.tagIds || []).filter(id => id !== tagId);

    if(!slot.title && !slot.notes && slot.tagIds.length === 0){
      delete appData.slots[id];
    }
  });

  activeFilters = activeFilters.filter(id => id !== tagId);
  saveData();
}

function getSlotData(dayName, hour){
  const id = slotId(dayName, hour);
  const data = appData.slots[id] || defaultSlot();
  return {
    title: String(data.title || ""),
    notes: String(data.notes || ""),
    tagIds: Array.isArray(data.tagIds)
      ? uniqueArray(data.tagIds).filter(id => !!appData.tags[id])
      : []
  };
}

function setSlotForSpecificId(slotKey, payload){
  const cleanPayload = {
    title: String(payload.title || "").trim(),
    notes: String(payload.notes || "").trim(),
    tagIds: uniqueArray(Array.isArray(payload.tagIds) ? payload.tagIds : []).filter(tagId => !!appData.tags[tagId])
  };

  if(!cleanPayload.title && !cleanPayload.notes && cleanPayload.tagIds.length === 0){
    delete appData.slots[slotKey];
  }else{
    appData.slots[slotKey] = cleanPayload;
  }
}

function getScopeTargetDays(scope){
  if(scope === "weekdays_same_hour"){
    return ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  }
  if(scope === "weekends_same_hour"){
    return ["Saturday","Sunday"];
  }
  if(scope === "all_days_same_hour"){
    return [...DISPLAY_DAYS];
  }
  return [activeDay];
}

function canHourExistForDay(dayName, hour){
  return buildHoursForDay(dayName).includes(hour);
}

function applySlotPayload(scope, payload){
  const targetDays = getScopeTargetDays(scope);

  targetDays.forEach(dayName => {
    if(canHourExistForDay(dayName, activeHour)){
      const id = slotId(dayName, activeHour);
      setSlotForSpecificId(id, payload);
    }
  });

  saveData();
  render();
}

function deleteSlotByScope(scope){
  const targetDays = getScopeTargetDays(scope);

  targetDays.forEach(dayName => {
    if(canHourExistForDay(dayName, activeHour)){
      delete appData.slots[slotId(dayName, activeHour)];
    }
  });

  saveData();
  render();
}

function getTagObjectsFromIds(tagIds){
  return tagIds.map(getTagById).filter(Boolean);
}

function createMultiColorBackground(colors){
  if(!colors.length) return "transparent";
  if(colors.length === 1) return colors[0];

  const step = 100 / colors.length;
  const parts = colors.map((color, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${color} ${start}%, ${color} ${end}%`;
  });

  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

function createColorDot(color, className = "tag-color-dot"){
  const dot = document.createElement("span");
  dot.className = className;
  dot.style.background = color;
  return dot;
}

function isVisibleByFilter(slot){
  if(activeFilters.length === 0) return true;
  return activeFilters.every(filterId => slot.tagIds.includes(filterId));
}

function getTotalPossibleSlots(){
  return DISPLAY_DAYS.reduce((sum, day) => sum + buildHoursForDay(day).length, 0);
}

/* ===== Filters ===== */
function renderFilters(){
  if(!tagFilters) return;
  tagFilters.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "filter-btn all-btn" + (activeFilters.length === 0 ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    activeFilters = [];
    render();
  });
  tagFilters.appendChild(allBtn);

  getTagsArray().forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (activeFilters.includes(tag.id) ? " active" : "");
    btn.style.background = tag.color;
    btn.textContent = tag.name;

    btn.addEventListener("click", () => {
      if(activeFilters.includes(tag.id)){
        activeFilters = activeFilters.filter(id => id !== tag.id);
      }else{
        activeFilters.push(tag.id);
      }
      activeFilters = uniqueArray(activeFilters);
      render();
    });

    tagFilters.appendChild(btn);
  });

  if(activeFilters.length === 0){
    filtersSubText.textContent = "Showing all slots";
  }else{
    filtersSubText.textContent = `Showing slots containing all selected tags (${activeFilters.length})`;
  }
}

/* ===== Analytics ===== */
function calculateAnalytics(){
  const totalPossibleSlots = getTotalPossibleSlots();
  const slotEntries = Object.entries(appData.slots);

  const filledSlots = slotEntries.length;
  const emptySlots = totalPossibleSlots - filledSlots;
  const totalTagAssignments = slotEntries.reduce((sum, [,slot]) => sum + (slot.tagIds?.length || 0), 0);

  const dayMap = {};
  DISPLAY_DAYS.forEach(day => {
    dayMap[day] = {
      total: buildHoursForDay(day).length,
      filled: 0
    };
  });

  const tagUsage = {};
  getTagsArray().forEach(tag => {
    tagUsage[tag.id] = 0;
  });

  slotEntries.forEach(([id, slot]) => {
    const [dayName] = id.split("__");
    if(dayMap[dayName]) dayMap[dayName].filled += 1;

    (slot.tagIds || []).forEach(tagId => {
      if(tagUsage[tagId] == null) tagUsage[tagId] = 0;
      tagUsage[tagId] += 1;
    });
  });

  let busiestDay = "—";
  let busiestCount = -1;
  DISPLAY_DAYS.forEach(day => {
    if(dayMap[day].filled > busiestCount){
      busiestCount = dayMap[day].filled;
      busiestDay = day;
    }
  });

  let mostUsedTagName = "—";
  let mostUsedTagCount = 0;
  getTagsArray().forEach(tag => {
    const count = tagUsage[tag.id] || 0;
    if(count > mostUsedTagCount){
      mostUsedTagCount = count;
      mostUsedTagName = tag.name;
    }
  });

  return {
    totalPossibleSlots,
    filledSlots,
    emptySlots,
    totalTagAssignments,
    busiestDay,
    busiestCount,
    mostUsedTagName,
    mostUsedTagCount,
    dayMap,
    tagUsage
  };
}

function renderAnalytics(){
  const data = calculateAnalytics();

  statsGrid.innerHTML = "";

  const statCards = [
    { k: "Filled Slots", v: `${data.filledSlots}` },
    { k: "Empty Slots", v: `${data.emptySlots}` },
    { k: "Most Used Tag", v: data.mostUsedTagName },
    { k: "Busiest Day", v: data.busiestDay }
  ];

  statCards.forEach(item => {
    const card = document.createElement("div");
    card.className = "stat";

    const k = document.createElement("div");
    k.className = "k";
    k.textContent = item.k;

    const v = document.createElement("div");
    v.className = "v";
    v.textContent = item.v;

    card.appendChild(k);
    card.appendChild(v);
    statsGrid.appendChild(card);
  });

  renderTagBreakdown(data);
  renderDayBreakdown(data);
}

function renderTagBreakdown(data){
  tagBreakdown.innerHTML = "";

  const tags = getTagsArray();
  if(tags.length === 0){
    tagBreakdown.innerHTML = `<div class="empty-manager">No tags created yet</div>`;
    return;
  }

  const maxCount = Math.max(1, ...tags.map(tag => data.tagUsage[tag.id] || 0));

  tags.forEach(tag => {
    const count = data.tagUsage[tag.id] || 0;

    const row = document.createElement("div");
    row.className = "breakdown-row";

    const label = document.createElement("div");
    label.className = "breakdown-label";
    const dot = document.createElement("span");
    dot.className = "breakdown-dot";
    dot.style.background = tag.color;
    const text = document.createElement("span");
    text.textContent = tag.name;
    label.appendChild(dot);
    label.appendChild(text);

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(count / maxCount) * 100}%`;
    fill.style.background = tag.color;

    bar.appendChild(fill);

    const value = document.createElement("div");
    value.className = "breakdown-value";
    value.textContent = `${count} hr`;

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(value);

    tagBreakdown.appendChild(row);
  });
}

function renderDayBreakdown(data){
  dayBreakdown.innerHTML = "";

  const maxFilled = Math.max(1, ...DISPLAY_DAYS.map(day => data.dayMap[day].filled));

  DISPLAY_DAYS.forEach(day => {
    const filled = data.dayMap[day].filled;
    const total = data.dayMap[day].total;

    const row = document.createElement("div");
    row.className = "breakdown-row";

    const label = document.createElement("div");
    label.className = "breakdown-label";
    label.textContent = day;

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(filled / maxFilled) * 100}%`;
    fill.style.background = "#1f1f1f";

    bar.appendChild(fill);

    const value = document.createElement("div");
    value.className = "breakdown-value";
    value.textContent = `${filled}/${total} slots`;

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(value);

    dayBreakdown.appendChild(row);
  });
}

/* ===== Timetable ===== */
function renderTimetable(){
  if(!timetable) return;
  timetable.innerHTML = "";

  const now = new Date();
  const currentDayName = DAYS[now.getDay()];
  const currentHour = now.getHours();

  DISPLAY_DAYS.forEach((dayName, idx) => {
    const dayWrap = document.createElement("div");
    dayWrap.className = "day" + (dayName === currentDayName ? " current-day" : "");

    const head = document.createElement("div");
    head.className = "day-head";

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = dayName;

    const sub = document.createElement("div");
    sub.className = "day-sub";
    sub.textContent = "12 AM — 11 PM";

    head.appendChild(title);
    head.appendChild(sub);

    const grid = document.createElement("div");
    grid.className = "slots";

    const hours = buildHoursForDay(dayName);

    hours.forEach(hour => {
      const data = getSlotData(dayName, hour);
      if(!isVisibleByFilter(data)) return;

      const tagObjects = getTagObjectsFromIds(data.tagIds);

      const slot = document.createElement("div");
      slot.className = "slot";
      if(tagObjects.length) slot.classList.add("has-tags");
      else slot.classList.add("empty");

      if(dayName === currentDayName && hour === currentHour){
        slot.classList.add("now");
      }

      const colorsBar = document.createElement("div");
      colorsBar.className = "slot-colors";
      colorsBar.style.background = createMultiColorBackground(tagObjects.map(tag => tag.color));

      const content = document.createElement("div");
      content.className = "slot-content";

      const time = document.createElement("div");
      time.className = "slot-time";
      time.textContent = hourToLabel(hour);

      const stitle = document.createElement("div");
      stitle.className = "slot-title";
      stitle.textContent = data.title ? data.title : (tagObjects.length ? "—" : "Tap to add");

      const note = document.createElement("div");
      note.className = "slot-note";
      note.textContent = data.notes ? data.notes : "";

      content.appendChild(time);
      content.appendChild(stitle);
      content.appendChild(note);

      if(tagObjects.length){
        const tagList = document.createElement("div");
        tagList.className = "slot-tag-list";

        tagObjects.forEach(tag => {
          const chip = document.createElement("div");
          chip.className = "slot-tag-chip";

          const dot = document.createElement("span");
          dot.className = "slot-tag-dot";
          dot.style.background = tag.color;

          const text = document.createElement("span");
          text.textContent = tag.name;

          chip.appendChild(dot);
          chip.appendChild(text);
          tagList.appendChild(chip);
        });

        content.appendChild(tagList);
      }

      slot.appendChild(colorsBar);
      slot.appendChild(content);

      slot.addEventListener("click", () => openModal(dayName, hour));
      grid.appendChild(slot);
    });

    dayWrap.appendChild(head);
    dayWrap.appendChild(grid);
    timetable.appendChild(dayWrap);

    dayWrap.style.animationDelay = `${idx * 55}ms`;
  });
}

/* ===== Slot Modal ===== */
function openModal(dayName, hour){
  activeDay = dayName;
  activeHour = hour;

  const data = getSlotData(dayName, hour);
  modalSelectedTagIds = [...data.tagIds];

  modalMeta.textContent = `${dayName} • ${hourToLabel(hour)}`;
  titleInput.value = data.title || "";
  notesInput.value = data.notes || "";
  newTagNameInput.value = "";
  applyScopeSelect.value = "this_slot";

  renderAvailableTags();
  renderSelectedTagsPreview();

  overlay.classList.remove("hidden");
}

function closeModal(){
  overlay.classList.add("hidden");
  activeDay = null;
  activeHour = null;
  modalSelectedTagIds = [];
  newTagNameInput.value = "";
  applyScopeSelect.value = "this_slot";
}

function renderAvailableTags(){
  if(!availableTagsEl) return;
  availableTagsEl.innerHTML = "";

  const tags = getTagsArray();
  if(!tags.length){
    availableTagsEl.innerHTML = `<div class="empty-preview">No tags created yet</div>`;
    return;
  }

  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-option" + (modalSelectedTagIds.includes(tag.id) ? " active" : "");
    btn.style.background = tag.color;

    const dot = createColorDot(tag.color);
    const text = document.createElement("span");
    text.textContent = tag.name;

    btn.appendChild(dot);
    btn.appendChild(text);

    btn.addEventListener("click", () => {
      if(modalSelectedTagIds.includes(tag.id)){
        modalSelectedTagIds = modalSelectedTagIds.filter(id => id !== tag.id);
      }else{
        modalSelectedTagIds.push(tag.id);
      }

      modalSelectedTagIds = uniqueArray(modalSelectedTagIds);
      renderAvailableTags();
      renderSelectedTagsPreview();
    });

    availableTagsEl.appendChild(btn);
  });
}

function renderSelectedTagsPreview(){
  if(!selectedTagsPreview) return;

  const tags = getTagObjectsFromIds(modalSelectedTagIds);
  if(!tags.length){
    selectedTagsPreview.classList.add("empty-preview");
    selectedTagsPreview.textContent = "No tags selected";
    return;
  }

  selectedTagsPreview.classList.remove("empty-preview");
  selectedTagsPreview.innerHTML = "";

  tags.forEach(tag => {
    const chip = document.createElement("div");
    chip.className = "selected-tag-chip";
    chip.style.background = tag.color;

    const dot = createColorDot(tag.color);
    const text = document.createElement("span");
    text.textContent = tag.name;

    chip.appendChild(dot);
    chip.appendChild(text);
    selectedTagsPreview.appendChild(chip);
  });
}

function addTagFromModal(){
  const name = normalizeTagName(newTagNameInput.value);
  const color = sanitizeColor(newTagColorInput.value);

  if(!name) return;

  const tag = getOrCreateTag(name, color);
  if(!tag) return;

  if(!modalSelectedTagIds.includes(tag.id)){
    modalSelectedTagIds.push(tag.id);
  }

  modalSelectedTagIds = uniqueArray(modalSelectedTagIds);
  newTagNameInput.value = "";

  renderAvailableTags();
  renderSelectedTagsPreview();
  renderFilters();
  renderAnalytics();
}

/* ===== Tag Manager ===== */
function openTagManager(){
  renderTagManager();
  tagManagerOverlay.classList.remove("hidden");
}

function closeTagManager(){
  tagManagerOverlay.classList.add("hidden");
}

function renderTagManager(){
  tagManagerList.innerHTML = "";

  const tags = getTagsArray();
  if(!tags.length){
    tagManagerList.innerHTML = `<div class="empty-manager">No tags created yet</div>`;
    return;
  }

  tags.forEach(tag => {
    const row = document.createElement("div");
    row.className = "tag-manager-row";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = sanitizeColor(tag.color);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 24;
    nameInput.value = tag.name;

    const preview = document.createElement("div");
    preview.className = "tag-preview-pill";
    preview.style.background = tag.color;
    preview.textContent = tag.name;

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-ghost";
    saveBtn.textContent = "Save";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";

    function syncPreview(){
      preview.style.background = sanitizeColor(colorInput.value);
      preview.textContent = normalizeTagName(nameInput.value) || "Tag";
    }

    colorInput.addEventListener("input", syncPreview);
    nameInput.addEventListener("input", syncPreview);

    saveBtn.addEventListener("click", () => {
      const result = renameOrUpdateTag(tag.id, nameInput.value, colorInput.value);
      if(!result.ok){
        alert(result.message);
        return;
      }
      render();
      renderTagManager();
      renderAvailableTags();
      renderSelectedTagsPreview();
    });

    deleteBtn.addEventListener("click", () => {
      const ok = confirm(`Delete tag "${tag.name}" from everywhere?`);
      if(!ok) return;

      deleteTagGlobally(tag.id);
      modalSelectedTagIds = modalSelectedTagIds.filter(id => id !== tag.id);

      render();
      renderTagManager();
      renderAvailableTags();
      renderSelectedTagsPreview();
    });

    row.appendChild(colorInput);
    row.appendChild(nameInput);
    row.appendChild(preview);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);

    tagManagerList.appendChild(row);
  });
}

/* ===== Main Render ===== */
function render(){
  renderFilters();
  renderAnalytics();
  renderTimetable();
}

/* ===== Events ===== */
btnClose?.addEventListener("click", closeModal);
btnCancel?.addEventListener("click", closeModal);
overlay?.addEventListener("click", (e) => {
  if(e.target === overlay) closeModal();
});

btnAddTag?.addEventListener("click", addTagFromModal);
newTagNameInput?.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){
    e.preventDefault();
    addTagFromModal();
  }
});

btnSave?.addEventListener("click", () => {
  if(activeDay == null || activeHour == null) return;

  const payload = {
    title: titleInput.value.trim(),
    notes: notesInput.value.trim(),
    tagIds: modalSelectedTagIds
  };

  applySlotPayload(applyScopeSelect.value, payload);
  closeModal();
});

btnDelete?.addEventListener("click", () => {
  if(activeDay == null || activeHour == null) return;
  deleteSlotByScope(applyScopeSelect.value);
  closeModal();
});

document.getElementById("btnClearAll")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY_V3);
  localStorage.removeItem(LEGACY_KEY_V2);
  appData = { tags: {}, slots: {} };
  activeFilters = [];
  render();
});

btnManageTags?.addEventListener("click", openTagManager);
btnCloseTagManager?.addEventListener("click", closeTagManager);
btnCloseTagManager2?.addEventListener("click", closeTagManager);
tagManagerOverlay?.addEventListener("click", (e) => {
  if(e.target === tagManagerOverlay) closeTagManager();
});

/* ===== Boot ===== */
render();
setInterval(render, 60 * 1000);