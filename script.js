/* ===========================
   WeekWise
   - all days: 12 AM to 11 PM
   - dynamic reusable tags
   - multiple tags per slot
   - global tag edit/delete
   - multi-select filters
   - recurring fill
   - weekly analytics
   - per-day variants
   =========================== */

const STORAGE_KEY_V4 = "WEEKWISE_DATA_V4";
const LEGACY_KEY_V3 = "WEEKWISE_DATA_V3";
const LEGACY_KEY_V2 = "WEEKWISE_SLOTS_V2";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DISPLAY_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const LEGACY_TYPE_MAP = {
  study: { name: "Study", color: "#baf3c0" },
  essential: { name: "Essential Break", color: "#fff1a8" },
  nonessential: { name: "Non-Essential Break", color: "#ffb4b4" }
};

function buildHoursForDay(){
  const hours = [];
  for(let h = 0; h < 24; h++) hours.push(h);
  return hours;
}

function hourToLabel(h){
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = (h % 12) === 0 ? 12 : (h % 12);
  return `${hour12}:00 ${suffix}`;
}

function slotHourKey(hour){
  return String(hour);
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

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function generateTagId(name){
  const cleaned = normalizeTagKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `tag-${Date.now()}`;
}

function slugifyVariant(name){
  return normalizeTagKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `variant-${Date.now()}`;
}

function getDefaultVariantsState(){
  const dayVariants = {};
  DISPLAY_DAYS.forEach(day => {
    dayVariants[day] = {
      activeVariantId: "default",
      variants: {
        default: {
          id: "default",
          name: "Default",
          slots: {}
        }
      }
    };
  });
  return dayVariants;
}

/* ===== Migration ===== */
function migrateFromV2(){
  const raw = localStorage.getItem(LEGACY_KEY_V2);
  const app = {
    tags: {},
    dayVariants: getDefaultVariantsState()
  };

  if(!raw) return app;

  let oldSlots = {};
  try{
    oldSlots = JSON.parse(raw) || {};
  }catch{
    oldSlots = {};
  }

  Object.entries(oldSlots).forEach(([id, value]) => {
    const old = value || {};
    const [dayName, hourStr] = id.split("__");
    const hour = Number(hourStr);

    if(!app.dayVariants[dayName] || Number.isNaN(hour)) return;

    const slot = defaultSlot();
    slot.title = String(old.title || "").trim();
    slot.notes = String(old.notes || "").trim();

    if(old.type && LEGACY_TYPE_MAP[old.type] && old.type !== "empty"){
      const legacyTag = LEGACY_TYPE_MAP[old.type];
      const tagId = generateTagId(legacyTag.name);

      if(!app.tags[tagId]){
        app.tags[tagId] = {
          id: tagId,
          name: legacyTag.name,
          color: legacyTag.color
        };
      }

      slot.tagIds.push(tagId);
    }

    if(slot.title || slot.notes || slot.tagIds.length){
      app.dayVariants[dayName].variants.default.slots[slotHourKey(hour)] = {
        title: slot.title,
        notes: slot.notes,
        tagIds: uniqueArray(slot.tagIds)
      };
    }
  });

  return app;
}

function migrateFromV3(){
  const raw = localStorage.getItem(LEGACY_KEY_V3);
  if(!raw) return null;

  try{
    const parsed = JSON.parse(raw);
    const app = {
      tags: parsed.tags && typeof parsed.tags === "object" ? parsed.tags : {},
      dayVariants: getDefaultVariantsState()
    };

    const slots = parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {};

    Object.entries(slots).forEach(([id, slot]) => {
      const [dayName, hourStr] = id.split("__");
      const hour = Number(hourStr);

      if(!app.dayVariants[dayName] || Number.isNaN(hour)) return;

      const cleanSlot = {
        title: String(slot.title || "").trim(),
        notes: String(slot.notes || "").trim(),
        tagIds: Array.isArray(slot.tagIds) ? uniqueArray(slot.tagIds) : []
      };

      if(cleanSlot.title || cleanSlot.notes || cleanSlot.tagIds.length){
        app.dayVariants[dayName].variants.default.slots[slotHourKey(hour)] = cleanSlot;
      }
    });

    return app;
  }catch{
    return null;
  }
}

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY_V4);
  if(raw){
    try{
      const parsed = JSON.parse(raw);
      if(parsed && typeof parsed === "object" && parsed.dayVariants){
        return parsed;
      }
    }catch{}
  }

  const migratedV3 = migrateFromV3();
  if(migratedV3){
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(migratedV3));
    return migratedV3;
  }

  const migratedV2 = migrateFromV2();
  localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(migratedV2));
  return migratedV2;
}

function saveData(){
  localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(appData));
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

const variantOverlay = document.getElementById("variantOverlay");
const btnCloseVariantModal = document.getElementById("btnCloseVariantModal");
const btnCloseVariantModal2 = document.getElementById("btnCloseVariantModal2");
const variantModalMeta = document.getElementById("variantModalMeta");
const newVariantNameInput = document.getElementById("newVariantName");
const btnCreateVariant = document.getElementById("btnCreateVariant");
const btnRenameVariant = document.getElementById("btnRenameVariant");
const btnDeleteVariant = document.getElementById("btnDeleteVariant");

let activeDay = null;
let activeHour = null;
let modalSelectedTagIds = [];

let variantManageDay = null;

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

/* ===== Tag helpers ===== */
function getTagsArray(){
  return Object.values(appData.tags || {}).sort((a, b) => a.name.localeCompare(b.name));
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

  DISPLAY_DAYS.forEach(day => {
    const state = appData.dayVariants[day];
    Object.values(state.variants).forEach(variant => {
      Object.keys(variant.slots).forEach(hourKey => {
        const slot = variant.slots[hourKey];
        slot.tagIds = (slot.tagIds || []).filter(id => id !== tagId);

        if(!slot.title && !slot.notes && slot.tagIds.length === 0){
          delete variant.slots[hourKey];
        }
      });
    });
  });

  activeFilters = activeFilters.filter(id => id !== tagId);
  saveData();
}

/* ===== Variant helpers ===== */
function ensureDayVariantState(dayName){
  if(!appData.dayVariants[dayName]){
    appData.dayVariants[dayName] = {
      activeVariantId: "default",
      variants: {
        default: {
          id: "default",
          name: "Default",
          slots: {}
        }
      }
    };
  }
  return appData.dayVariants[dayName];
}

function getDayState(dayName){
  return ensureDayVariantState(dayName);
}

function getActiveVariant(dayName){
  const state = getDayState(dayName);
  return state.variants[state.activeVariantId] || state.variants.default;
}

function getActiveVariantId(dayName){
  return getDayState(dayName).activeVariantId;
}

function getVariantsArray(dayName){
  const state = getDayState(dayName);
  return Object.values(state.variants);
}

function switchActiveVariant(dayName, variantId){
  const state = getDayState(dayName);
  if(!state.variants[variantId]) return;
  state.activeVariantId = variantId;
  saveData();
  render();
}

function createVariantForDay(dayName, variantName){
  const cleanName = normalizeTagName(variantName);
  if(!cleanName) return { ok:false, message:"Variant name cannot be empty" };

  const state = getDayState(dayName);
  const duplicateName = Object.values(state.variants).find(
    v => normalizeTagKey(v.name) === normalizeTagKey(cleanName)
  );
  if(duplicateName){
    return { ok:false, message:"Variant name already exists for this day" };
  }

  let variantId = slugifyVariant(cleanName);
  let count = 1;
  while(state.variants[variantId]){
    count += 1;
    variantId = `${slugifyVariant(cleanName)}-${count}`;
  }

  const currentVariant = getActiveVariant(dayName);

  state.variants[variantId] = {
    id: variantId,
    name: cleanName,
    slots: clone(currentVariant.slots || {})
  };
  state.activeVariantId = variantId;
  saveData();
  return { ok:true };
}

function renameCurrentVariant(dayName, newName){
  const cleanName = normalizeTagName(newName);
  if(!cleanName) return { ok:false, message:"Variant name cannot be empty" };

  const state = getDayState(dayName);
  const currentId = state.activeVariantId;
  const current = state.variants[currentId];
  if(!current) return { ok:false, message:"Variant not found" };

  const duplicate = Object.values(state.variants).find(
    v => v.id !== currentId && normalizeTagKey(v.name) === normalizeTagKey(cleanName)
  );
  if(duplicate){
    return { ok:false, message:"Variant name already exists for this day" };
  }

  current.name = cleanName;
  saveData();
  return { ok:true };
}

function deleteCurrentVariant(dayName){
  const state = getDayState(dayName);
  const currentId = state.activeVariantId;
  if(currentId === "default"){
    return { ok:false, message:"Default variant cannot be deleted" };
  }

  delete state.variants[currentId];
  state.activeVariantId = "default";
  saveData();
  return { ok:true };
}

/* ===== Slot helpers ===== */
function getSlotData(dayName, hour, variantId = null){
  const state = getDayState(dayName);
  const activeId = variantId || state.activeVariantId;
  const variant = state.variants[activeId] || state.variants.default;
  const data = variant.slots[slotHourKey(hour)] || defaultSlot();

  return {
    title: String(data.title || ""),
    notes: String(data.notes || ""),
    tagIds: Array.isArray(data.tagIds)
      ? uniqueArray(data.tagIds).filter(id => !!appData.tags[id])
      : []
  };
}

function setSlotForDayVariant(dayName, variantId, hour, payload){
  const state = getDayState(dayName);
  const variant = state.variants[variantId];
  if(!variant) return;

  const cleanPayload = {
    title: String(payload.title || "").trim(),
    notes: String(payload.notes || "").trim(),
    tagIds: uniqueArray(Array.isArray(payload.tagIds) ? payload.tagIds : []).filter(tagId => !!appData.tags[tagId])
  };

  const key = slotHourKey(hour);

  if(!cleanPayload.title && !cleanPayload.notes && cleanPayload.tagIds.length === 0){
    delete variant.slots[key];
  }else{
    variant.slots[key] = cleanPayload;
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

function applySlotPayload(scope, payload){
  const targetDays = getScopeTargetDays(scope);

  targetDays.forEach(dayName => {
    const variantId = getActiveVariantId(dayName);
    setSlotForDayVariant(dayName, variantId, activeHour, payload);
  });

  saveData();
  render();
}

function deleteSlotByScope(scope){
  const targetDays = getScopeTargetDays(scope);
  targetDays.forEach(dayName => {
    const variantId = getActiveVariantId(dayName);
    const state = getDayState(dayName);
    const variant = state.variants[variantId];
    if(variant){
      delete variant.slots[slotHourKey(activeHour)];
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

/* ===== Filters ===== */
function isVisibleByFilter(slot){
  if(activeFilters.length === 0) return true;
  return activeFilters.every(filterId => slot.tagIds.includes(filterId));
}

function renderFilters(){
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

  filtersSubText.textContent =
    activeFilters.length === 0
      ? "Showing all slots"
      : `Showing slots containing all selected tags (${activeFilters.length})`;
}

/* ===== Analytics ===== */
function getTotalPossibleSlots(){
  return DISPLAY_DAYS.length * buildHoursForDay().length;
}

function calculateAnalytics(){
  const totalPossibleSlots = getTotalPossibleSlots();

  let filledSlots = 0;
  const tagUsage = {};
  const dayMap = {};

  getTagsArray().forEach(tag => {
    tagUsage[tag.id] = 0;
  });

  DISPLAY_DAYS.forEach(day => {
    const activeVariant = getActiveVariant(day);
    const slots = activeVariant.slots || {};
    const entries = Object.entries(slots);

    dayMap[day] = {
      total: buildHoursForDay().length,
      filled: entries.length
    };

    filledSlots += entries.length;

    entries.forEach(([, slot]) => {
      (slot.tagIds || []).forEach(tagId => {
        if(tagUsage[tagId] == null) tagUsage[tagId] = 0;
        tagUsage[tagId] += 1;
      });
    });
  });

  const emptySlots = totalPossibleSlots - filledSlots;

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
    busiestDay,
    mostUsedTagName,
    tagUsage,
    dayMap
  };
}

function renderAnalytics(){
  const data = calculateAnalytics();

  statsGrid.innerHTML = "";

  const cards = [
    { k: "Filled Slots", v: `${data.filledSlots}` },
    { k: "Empty Slots", v: `${data.emptySlots}` },
    { k: "Most Used Tag", v: data.mostUsedTagName },
    { k: "Busiest Day", v: data.busiestDay }
  ];

  cards.forEach(item => {
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

  if(!tags.length){
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
    const activeVariant = getActiveVariant(day);

    const row = document.createElement("div");
    row.className = "breakdown-row";

    const label = document.createElement("div");
    label.className = "breakdown-label";
    label.textContent = `${day} (${activeVariant.name})`;

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
  timetable.innerHTML = "";

  const now = new Date();
  const currentDayName = DAYS[now.getDay()];
  const currentHour = now.getHours();

  DISPLAY_DAYS.forEach((dayName, idx) => {
    const dayWrap = document.createElement("div");
    dayWrap.className = "day" + (dayName === currentDayName ? " current-day" : "");

    const head = document.createElement("div");
    head.className = "day-head";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = dayName;

    const sub = document.createElement("div");
    sub.className = "day-sub";
    sub.textContent = "12 AM — 11 PM";

    left.appendChild(title);
    left.appendChild(sub);

    const controls = document.createElement("div");
    controls.className = "day-controls";

    const select = document.createElement("select");
    select.className = "variant-select";

    getVariantsArray(dayName).forEach(variant => {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = variant.name;
      if(variant.id === getActiveVariantId(dayName)) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      switchActiveVariant(dayName, select.value);
    });

    const manageBtn = document.createElement("button");
    manageBtn.className = "btn btn-ghost";
    manageBtn.textContent = "Variants";
    manageBtn.addEventListener("click", () => openVariantManager(dayName));

    controls.appendChild(select);
    controls.appendChild(manageBtn);

    head.appendChild(left);
    head.appendChild(controls);

    const grid = document.createElement("div");
    grid.className = "slots";

    buildHoursForDay().forEach(hour => {
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

/* ===== Slot modal ===== */
function openModal(dayName, hour){
  activeDay = dayName;
  activeHour = hour;

  const data = getSlotData(dayName, hour);
  modalSelectedTagIds = [...data.tagIds];

  const variant = getActiveVariant(dayName);
  modalMeta.textContent = `${dayName} • ${variant.name} • ${hourToLabel(hour)}`;

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

/* ===== Tag manager ===== */
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

/* ===== Variant manager ===== */
function openVariantManager(dayName){
  variantManageDay = dayName;
  newVariantNameInput.value = "";
  const activeVariant = getActiveVariant(dayName);
  variantModalMeta.textContent = `${dayName} • Current Variant: ${activeVariant.name}`;
  variantOverlay.classList.remove("hidden");
}

function closeVariantManager(){
  variantOverlay.classList.add("hidden");
  variantManageDay = null;
  newVariantNameInput.value = "";
}

function createVariantFromCurrent(){
  if(!variantManageDay) return;
  const name = normalizeTagName(newVariantNameInput.value);
  if(!name){
    alert("Enter a variant name.");
    return;
  }
  const result = createVariantForDay(variantManageDay, name);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openVariantManager(variantManageDay);
}

function renameCurrentVariantFromModal(){
  if(!variantManageDay) return;
  const name = normalizeTagName(newVariantNameInput.value);
  if(!name){
    alert("Enter a new variant name.");
    return;
  }
  const result = renameCurrentVariant(variantManageDay, name);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openVariantManager(variantManageDay);
}

function deleteCurrentVariantFromModal(){
  if(!variantManageDay) return;
  const activeVariant = getActiveVariant(variantManageDay);
  const ok = confirm(`Delete variant "${activeVariant.name}" for ${variantManageDay}?`);
  if(!ok) return;

  const result = deleteCurrentVariant(variantManageDay);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openVariantManager(variantManageDay);
}

/* ===== Main render ===== */
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

btnManageTags?.addEventListener("click", openTagManager);
btnCloseTagManager?.addEventListener("click", closeTagManager);
btnCloseTagManager2?.addEventListener("click", closeTagManager);
tagManagerOverlay?.addEventListener("click", (e) => {
  if(e.target === tagManagerOverlay) closeTagManager();
});

btnCloseVariantModal?.addEventListener("click", closeVariantManager);
btnCloseVariantModal2?.addEventListener("click", closeVariantManager);
variantOverlay?.addEventListener("click", (e) => {
  if(e.target === variantOverlay) closeVariantManager();
});

btnCreateVariant?.addEventListener("click", createVariantFromCurrent);
btnRenameVariant?.addEventListener("click", renameCurrentVariantFromModal);
btnDeleteVariant?.addEventListener("click", deleteCurrentVariantFromModal);

document.getElementById("btnClearAll")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY_V4);
  localStorage.removeItem(LEGACY_KEY_V3);
  localStorage.removeItem(LEGACY_KEY_V2);
  appData = {
    tags: {},
    dayVariants: getDefaultVariantsState()
  };
  activeFilters = [];
  render();
});

/* ===== Boot ===== */
render();
setInterval(render, 60 * 1000);