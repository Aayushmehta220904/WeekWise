const STORAGE_KEY_V5 = "WEEKWISE_DATA_V5";
const LEGACY_KEY_V4 = "WEEKWISE_DATA_V4";
const LEGACY_KEY_V3 = "WEEKWISE_DATA_V3";
const LEGACY_KEY_V2 = "WEEKWISE_SLOTS_V2";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DISPLAY_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DEFAULT_PRESET_ID = "normal-week";

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
    tagIds: [],
    locked: false
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

function slugifyPreset(name){
  return normalizeTagKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `preset-${Date.now()}`;
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

function getDefaultPresetsState(){
  const dayVariantMap = {};
  DISPLAY_DAYS.forEach(day => {
    dayVariantMap[day] = "default";
  });

  return {
    activePresetId: DEFAULT_PRESET_ID,
    presets: {
      [DEFAULT_PRESET_ID]: {
        id: DEFAULT_PRESET_ID,
        name: "Normal Week",
        dayVariantMap
      }
    }
  };
}

function normalizeSlot(slot){
  return {
    title: String(slot?.title || "").trim(),
    notes: String(slot?.notes || "").trim(),
    tagIds: Array.isArray(slot?.tagIds) ? uniqueArray(slot.tagIds) : [],
    locked: !!slot?.locked
  };
}

function normalizeAppData(app){
  const normalized = {
    tags: app?.tags && typeof app.tags === "object" ? app.tags : {},
    dayVariants: app?.dayVariants && typeof app.dayVariants === "object" ? app.dayVariants : getDefaultVariantsState(),
    activePresetId: app?.activePresetId ?? DEFAULT_PRESET_ID,
    presets: app?.presets && typeof app.presets === "object" ? app.presets : getDefaultPresetsState().presets
  };

  DISPLAY_DAYS.forEach(day => {
    if(!normalized.dayVariants[day]){
      normalized.dayVariants[day] = {
        activeVariantId: "default",
        variants: {
          default: { id: "default", name: "Default", slots: {} }
        }
      };
    }

    const state = normalized.dayVariants[day];
    if(!state.variants || typeof state.variants !== "object"){
      state.variants = {};
    }
    if(!state.variants.default){
      state.variants.default = { id: "default", name: "Default", slots: {} };
    }
    if(!state.activeVariantId || !state.variants[state.activeVariantId]){
      state.activeVariantId = "default";
    }

    Object.values(state.variants).forEach(variant => {
      if(!variant.slots || typeof variant.slots !== "object"){
        variant.slots = {};
      }
      Object.keys(variant.slots).forEach(hourKey => {
        variant.slots[hourKey] = normalizeSlot(variant.slots[hourKey]);
        const s = variant.slots[hourKey];
        if(!s.title && !s.notes && s.tagIds.length === 0 && !s.locked){
          delete variant.slots[hourKey];
        }
      });
    });
  });

  if(!normalized.presets || Object.keys(normalized.presets).length === 0){
    const fallback = getDefaultPresetsState();
    normalized.presets = fallback.presets;
    normalized.activePresetId = fallback.activePresetId;
  }

  if(normalized.activePresetId !== null && !normalized.presets[normalized.activePresetId]){
    normalized.activePresetId = null;
  }

  return normalized;
}

/* Migration */
function migrateFromV2(){
  const raw = localStorage.getItem(LEGACY_KEY_V2);
  const app = {
    tags: {},
    dayVariants: getDefaultVariantsState(),
    ...getDefaultPresetsState()
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

    if(slot.title || slot.notes || slot.tagIds.length || slot.locked){
      app.dayVariants[dayName].variants.default.slots[slotHourKey(hour)] = normalizeSlot(slot);
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
      dayVariants: getDefaultVariantsState(),
      ...getDefaultPresetsState()
    };

    const slots = parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {};
    Object.entries(slots).forEach(([id, slot]) => {
      const [dayName, hourStr] = id.split("__");
      const hour = Number(hourStr);
      if(!app.dayVariants[dayName] || Number.isNaN(hour)) return;

      const cleanSlot = normalizeSlot(slot);
      if(cleanSlot.title || cleanSlot.notes || cleanSlot.tagIds.length || cleanSlot.locked){
        app.dayVariants[dayName].variants.default.slots[slotHourKey(hour)] = cleanSlot;
      }
    });

    return app;
  }catch{
    return null;
  }
}

function migrateFromV4(){
  const raw = localStorage.getItem(LEGACY_KEY_V4);
  if(!raw) return null;

  try{
    const parsed = JSON.parse(raw);
    const app = normalizeAppData({
      tags: parsed.tags,
      dayVariants: parsed.dayVariants,
      ...getDefaultPresetsState()
    });

    DISPLAY_DAYS.forEach(day => {
      app.presets[DEFAULT_PRESET_ID].dayVariantMap[day] = app.dayVariants[day].activeVariantId || "default";
    });

    return app;
  }catch{
    return null;
  }
}

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY_V5);
  if(raw){
    try{
      return normalizeAppData(JSON.parse(raw));
    }catch{}
  }

  const v4 = migrateFromV4();
  if(v4){
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(v4));
    return v4;
  }

  const v3 = migrateFromV3();
  if(v3){
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(v3));
    return v3;
  }

  const v2 = migrateFromV2();
  localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(v2));
  return v2;
}

function saveData(){
  localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(appData));
}

let appData = loadData();
let activeFilters = [];
let analyticsOpen = false;

/* DOM */
const intro = document.getElementById("intro");
const typeEl = document.getElementById("typeText");

const timetable = document.getElementById("timetable");
const tagFilters = document.getElementById("tagFilters");
const filtersSubText = document.getElementById("filtersSubText");

const statsGrid = document.getElementById("statsGrid");
const tagBreakdown = document.getElementById("tagBreakdown");
const dayBreakdown = document.getElementById("dayBreakdown");

const presetSelect = document.getElementById("presetSelect");
const btnCreatePreset = document.getElementById("btnCreatePreset");
const presetSubText = document.getElementById("presetSubText");

const btnToggleAnalytics = document.getElementById("btnToggleAnalytics");
const analyticsPanel = document.getElementById("analyticsPanel");
const analyticsToggleIcon = document.getElementById("analyticsToggleIcon");

const overlay = document.getElementById("modalOverlay");
const btnClose = document.getElementById("btnCloseModal");
const btnCancel = document.getElementById("btnCancel");
const btnSave = document.getElementById("btnSave");
const btnDelete = document.getElementById("btnDeleteSlot");
const btnAddTag = document.getElementById("btnAddTag");

const modalMeta = document.getElementById("modalMeta");
const titleInput = document.getElementById("slotTitle");
const notesInput = document.getElementById("slotNotes");
const slotLockedInput = document.getElementById("slotLocked");
const availableTagsEl = document.getElementById("availableTags");
const selectedTagsPreview = document.getElementById("selectedTagsPreview");
const newTagNameInput = document.getElementById("newTagName");
const newTagColorInput = document.getElementById("newTagColor");
const applyScopeSelect = document.getElementById("applyScope");

const dayManagerOverlay = document.getElementById("dayManagerOverlay");
const btnCloseDayManager = document.getElementById("btnCloseDayManager");
const btnCloseDayManager2 = document.getElementById("btnCloseDayManager2");
const dayManagerMeta = document.getElementById("dayManagerMeta");
const dayVariantSelect = document.getElementById("dayVariantSelect");
const btnDuplicateVariant = document.getElementById("btnDuplicateVariant");
const btnRenameVariant = document.getElementById("btnRenameVariant");
const btnDeleteVariant = document.getElementById("btnDeleteVariant");
const copyDayTarget = document.getElementById("copyDayTarget");
const btnCopyDayNow = document.getElementById("btnCopyDayNow");

const toolsOverlay = document.getElementById("toolsOverlay");
const btnOpenTools = document.getElementById("btnOpenTools");
const btnCloseTools = document.getElementById("btnCloseTools");
const btnCloseTools2 = document.getElementById("btnCloseTools2");
const btnOpenTagManagerFromTools = document.getElementById("btnOpenTagManagerFromTools");
const btnOpenPresetManagerFromTools = document.getElementById("btnOpenPresetManagerFromTools");

const tagManagerOverlay = document.getElementById("tagManagerOverlay");
const btnManageTags = document.getElementById("btnOpenTagManagerFromTools");
const btnCloseTagManager = document.getElementById("btnCloseTagManager");
const btnCloseTagManager2 = document.getElementById("btnCloseTagManager2");
const tagManagerList = document.getElementById("tagManagerList");

const presetOverlay = document.getElementById("presetOverlay");
const btnClosePresetModal = document.getElementById("btnClosePresetModal");
const btnClosePresetModal2 = document.getElementById("btnClosePresetModal2");
const presetNameInput = document.getElementById("presetNameInput");
const btnRenamePreset = document.getElementById("btnRenamePreset");
const btnDeletePreset = document.getElementById("btnDeletePreset");

const btnClearAll = document.getElementById("btnClearAll");

let activeDay = null;
let activeHour = null;
let modalSelectedTagIds = [];
let managedDay = null;

/* Intro */
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

/* Tag helpers */
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
        const slot = normalizeSlot(variant.slots[hourKey]);
        slot.tagIds = slot.tagIds.filter(id => id !== tagId);

        if(!slot.title && !slot.notes && slot.tagIds.length === 0 && !slot.locked){
          delete variant.slots[hourKey];
        }else{
          variant.slots[hourKey] = slot;
        }
      });
    });
  });

  activeFilters = activeFilters.filter(id => id !== tagId);
  saveData();
}

/* Variant helpers */
function ensureDayVariantState(dayName){
  if(!appData.dayVariants[dayName]){
    appData.dayVariants[dayName] = {
      activeVariantId: "default",
      variants: {
        default: { id: "default", name: "Default", slots: {} }
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
  return Object.values(getDayState(dayName).variants);
}

function switchActiveVariant(dayName, variantId, source = "manual"){
  const state = getDayState(dayName);
  if(!state.variants[variantId]) return;
  state.activeVariantId = variantId;
  if(source === "manual"){
    appData.activePresetId = null;
  }
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
  appData.activePresetId = null;
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
  appData.activePresetId = null;
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
  appData.activePresetId = null;

  Object.values(appData.presets).forEach(preset => {
    if(preset.dayVariantMap[dayName] === currentId){
      preset.dayVariantMap[dayName] = "default";
    }
  });

  saveData();
  return { ok:true };
}

/* Preset helpers */
function getPresetsArray(){
  return Object.values(appData.presets).sort((a, b) => a.name.localeCompare(b.name));
}

function getActivePreset(){
  if(appData.activePresetId == null) return null;
  return appData.presets[appData.activePresetId] || null;
}

function getCurrentWeekVariantMap(){
  const map = {};
  DISPLAY_DAYS.forEach(day => {
    map[day] = getActiveVariantId(day);
  });
  return map;
}

function applyPreset(presetId){
  const preset = appData.presets[presetId];
  if(!preset) return;

  DISPLAY_DAYS.forEach(day => {
    const targetVariantId = preset.dayVariantMap[day];
    const state = getDayState(day);
    state.activeVariantId = state.variants[targetVariantId] ? targetVariantId : "default";
  });

  appData.activePresetId = presetId;
  saveData();
  render();
}

function createPresetFromCurrent(name){
  const cleanName = normalizeTagName(name);
  if(!cleanName) return { ok:false, message:"Preset name cannot be empty" };

  const duplicate = getPresetsArray().find(p => normalizeTagKey(p.name) === normalizeTagKey(cleanName));
  if(duplicate){
    return { ok:false, message:"Preset name already exists" };
  }

  let presetId = slugifyPreset(cleanName);
  let count = 1;
  while(appData.presets[presetId]){
    count += 1;
    presetId = `${slugifyPreset(cleanName)}-${count}`;
  }

  appData.presets[presetId] = {
    id: presetId,
    name: cleanName,
    dayVariantMap: getCurrentWeekVariantMap()
  };
  appData.activePresetId = presetId;
  saveData();
  return { ok:true };
}

function renameCurrentPreset(newName){
  const preset = getActivePreset();
  if(!preset) return { ok:false, message:"No saved preset is currently active" };

  const cleanName = normalizeTagName(newName);
  if(!cleanName) return { ok:false, message:"Preset name cannot be empty" };

  const duplicate = getPresetsArray().find(
    p => p.id !== preset.id && normalizeTagKey(p.name) === normalizeTagKey(cleanName)
  );
  if(duplicate){
    return { ok:false, message:"Preset name already exists" };
  }

  preset.name = cleanName;
  saveData();
  return { ok:true };
}

function deleteCurrentPreset(){
  const preset = getActivePreset();
  if(!preset) return { ok:false, message:"No saved preset is currently active" };
  if(preset.id === DEFAULT_PRESET_ID){
    return { ok:false, message:"Normal Week preset cannot be deleted" };
  }

  delete appData.presets[preset.id];
  appData.activePresetId = null;
  saveData();
  return { ok:true };
}

/* Slot helpers */
function getSlotData(dayName, hour, variantId = null){
  const state = getDayState(dayName);
  const activeId = variantId || state.activeVariantId;
  const variant = state.variants[activeId] || state.variants.default;
  const data = variant.slots[slotHourKey(hour)] || defaultSlot();

  const clean = normalizeSlot(data);
  clean.tagIds = clean.tagIds.filter(id => !!appData.tags[id]);
  return clean;
}

function setSlotForDayVariant(dayName, variantId, hour, payload){
  const state = getDayState(dayName);
  const variant = state.variants[variantId];
  if(!variant) return;

  const cleanPayload = normalizeSlot(payload);
  cleanPayload.tagIds = cleanPayload.tagIds.filter(tagId => !!appData.tags[tagId]);

  const key = slotHourKey(hour);

  if(!cleanPayload.title && !cleanPayload.notes && cleanPayload.tagIds.length === 0 && !cleanPayload.locked){
    delete variant.slots[key];
  }else{
    variant.slots[key] = cleanPayload;
  }
}

function isSlotLocked(dayName, variantId, hour){
  const slot = getSlotData(dayName, hour, variantId);
  return !!slot.locked;
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
    const shouldSkip =
      scope !== "this_slot" &&
      !(dayName === activeDay) &&
      isSlotLocked(dayName, variantId, activeHour);

    if(shouldSkip) return;
    setSlotForDayVariant(dayName, variantId, activeHour, payload);
  });

  appData.activePresetId = null;
  saveData();
  render();
}

function deleteSlotByScope(scope){
  const targetDays = getScopeTargetDays(scope);

  targetDays.forEach(dayName => {
    const variantId = getActiveVariantId(dayName);
    const variant = getDayState(dayName).variants[variantId];
    if(!variant) return;

    const shouldSkip =
      scope !== "this_slot" &&
      !(dayName === activeDay) &&
      isSlotLocked(dayName, variantId, activeHour);

    if(shouldSkip) return;
    delete variant.slots[slotHourKey(activeHour)];
  });

  appData.activePresetId = null;
  saveData();
  render();
}

function duplicateCurrentVariantQuick(dayName){
  const current = getActiveVariant(dayName);
  const suggestion = current.name === "Default" ? `${dayName} Copy` : `${current.name} Copy`;
  const name = prompt(`New variant name for ${dayName}:`, suggestion);
  if(name == null) return;

  const result = createVariantForDay(dayName, name);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  if(managedDay === dayName) openDayManager(dayName);
}

function copyWholeDayToAnotherDay(sourceDay, targetDay){
  const sourceVariant = getActiveVariant(sourceDay);
  const targetVariantId = getActiveVariantId(targetDay);

  buildHoursForDay().forEach(hour => {
    const targetLocked = isSlotLocked(targetDay, targetVariantId, hour);
    if(targetLocked) return;

    const sourceSlot = getSlotData(sourceDay, hour, sourceVariant.id);
    setSlotForDayVariant(targetDay, targetVariantId, hour, sourceSlot);
  });

  appData.activePresetId = null;
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

/* Filters */
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

/* Preset UI */
function renderPresetSelect(){
  presetSelect.innerHTML = "";

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Custom / Unsaved";
  if(appData.activePresetId == null) customOption.selected = true;
  presetSelect.appendChild(customOption);

  getPresetsArray().forEach(preset => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    if(appData.activePresetId === preset.id) option.selected = true;
    presetSelect.appendChild(option);
  });

  const activePreset = getActivePreset();
  presetSubText.textContent = activePreset
    ? `Active mode: ${activePreset.name}`
    : "Custom current week is active";
}

/* Analytics */
function renderAnalyticsVisibility(){
  analyticsPanel.classList.toggle("hidden", !analyticsOpen);
  analyticsToggleIcon.textContent = analyticsOpen ? "▲" : "▼";
}

function getTotalPossibleSlots(){
  return DISPLAY_DAYS.length * buildHoursForDay().length;
}

function calculateAnalytics(){
  const totalPossibleSlots = getTotalPossibleSlots();

  let filledSlots = 0;
  let lockedSlots = 0;
  const tagUsage = {};
  const dayMap = {};

  getTagsArray().forEach(tag => {
    tagUsage[tag.id] = 0;
  });

  DISPLAY_DAYS.forEach(day => {
    const activeVariant = getActiveVariant(day);
    const slots = activeVariant.slots || {};
    const entries = Object.entries(slots);

    let dayFilled = 0;

    entries.forEach(([, slot]) => {
      const clean = normalizeSlot(slot);

      if(clean.locked) lockedSlots += 1;
      if(clean.title || clean.notes || clean.tagIds.length || clean.locked){
        dayFilled += 1;
      }

      clean.tagIds.forEach(tagId => {
        if(tagUsage[tagId] == null) tagUsage[tagId] = 0;
        tagUsage[tagId] += 1;
      });
    });

    dayMap[day] = {
      total: buildHoursForDay().length,
      filled: dayFilled
    };

    filledSlots += dayFilled;
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
    lockedSlots,
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
    { k: "Locked Slots", v: `${data.lockedSlots}` },
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

/* Timetable */
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

    const variantChip = document.createElement("div");
    variantChip.className = "day-variant-chip";
    variantChip.textContent = `Variant: ${getActiveVariant(dayName).name}`;

    left.appendChild(title);
    left.appendChild(sub);
    left.appendChild(variantChip);

    const controls = document.createElement("div");
    controls.className = "day-controls";

    const manageBtn = document.createElement("button");
    manageBtn.className = "btn btn-ghost";
    manageBtn.textContent = "Manage";
    manageBtn.addEventListener("click", () => openDayManager(dayName));

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
      if(data.locked) slot.classList.add("locked-slot");
      if(dayName === currentDayName && hour === currentHour){
        slot.classList.add("now");
      }

      const colorsBar = document.createElement("div");
      colorsBar.className = "slot-colors";
      colorsBar.style.background = createMultiColorBackground(tagObjects.map(tag => tag.color));

      const content = document.createElement("div");
      content.className = "slot-content";

      const timeRow = document.createElement("div");
      timeRow.className = "slot-time-row";

      const time = document.createElement("div");
      time.className = "slot-time";
      time.textContent = hourToLabel(hour);

      const lock = document.createElement("div");
      lock.className = "slot-lock";
      lock.textContent = data.locked ? "🔒" : "";

      timeRow.appendChild(time);
      timeRow.appendChild(lock);

      const stitle = document.createElement("div");
      stitle.className = "slot-title";
      stitle.textContent = data.title ? data.title : (tagObjects.length || data.locked ? "—" : "Tap to add");

      const note = document.createElement("div");
      note.className = "slot-note";
      note.textContent = data.notes ? data.notes : "";

      content.appendChild(timeRow);
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

/* Slot modal */
function openModal(dayName, hour){
  activeDay = dayName;
  activeHour = hour;

  const data = getSlotData(dayName, hour);
  modalSelectedTagIds = [...data.tagIds];

  const variant = getActiveVariant(dayName);
  modalMeta.textContent = `${dayName} • ${variant.name} • ${hourToLabel(hour)}`;

  titleInput.value = data.title || "";
  notesInput.value = data.notes || "";
  slotLockedInput.checked = !!data.locked;
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
  slotLockedInput.checked = false;
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

/* Day Manager */
function openDayManager(dayName){
  managedDay = dayName;
  dayManagerMeta.textContent = `${dayName} • Current Variant: ${getActiveVariant(dayName).name}`;

  dayVariantSelect.innerHTML = "";
  getVariantsArray(dayName).forEach(variant => {
    const option = document.createElement("option");
    option.value = variant.id;
    option.textContent = variant.name;
    if(variant.id === getActiveVariantId(dayName)) option.selected = true;
    dayVariantSelect.appendChild(option);
  });

  copyDayTarget.innerHTML = "";
  DISPLAY_DAYS.filter(d => d !== dayName).forEach(day => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    copyDayTarget.appendChild(option);
  });

  dayManagerOverlay.classList.remove("hidden");
}

function closeDayManager(){
  dayManagerOverlay.classList.add("hidden");
  managedDay = null;
}

function renameCurrentVariantFromManager(){
  if(!managedDay) return;
  const current = getActiveVariant(managedDay);
  const newName = prompt(`Rename variant "${current.name}"`, current.name);
  if(newName == null) return;

  const result = renameCurrentVariant(managedDay, newName);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openDayManager(managedDay);
}

function deleteCurrentVariantFromManager(){
  if(!managedDay) return;
  const current = getActiveVariant(managedDay);
  const ok = confirm(`Delete variant "${current.name}" for ${managedDay}?`);
  if(!ok) return;

  const result = deleteCurrentVariant(managedDay);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openDayManager(managedDay);
}

function copyDayFromManager(){
  if(!managedDay) return;
  const target = copyDayTarget.value;
  if(!target) return;
  copyWholeDayToAnotherDay(managedDay, target);
  openDayManager(managedDay);
}

/* Tools */
function openTools(){ toolsOverlay.classList.remove("hidden"); }
function closeTools(){ toolsOverlay.classList.add("hidden"); }

/* Tag manager */
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

/* Preset manager */
function openPresetManager(){
  const preset = getActivePreset();
  presetNameInput.value = preset ? preset.name : "";
  presetOverlay.classList.remove("hidden");
}
function closePresetManager(){
  presetOverlay.classList.add("hidden");
  presetNameInput.value = "";
}
function createPresetFromCurrentPrompt(){
  const suggestion = "Exam Week";
  const name = prompt("New week mode name:", suggestion);
  if(name == null) return;

  const result = createPresetFromCurrent(name);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
}
function renameCurrentPresetFromModal(){
  const name = normalizeTagName(presetNameInput.value);
  if(!name){
    alert("Enter a week mode name.");
    return;
  }
  const result = renameCurrentPreset(name);
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openPresetManager();
}
function deleteCurrentPresetFromModal(){
  const preset = getActivePreset();
  if(!preset){
    alert("No saved week mode is currently active.");
    return;
  }
  const ok = confirm(`Delete week mode "${preset.name}"?`);
  if(!ok) return;

  const result = deleteCurrentPreset();
  if(!result.ok){
    alert(result.message);
    return;
  }
  render();
  openPresetManager();
}

/* Main render */
function render(){
  renderPresetSelect();
  renderFilters();
  renderAnalyticsVisibility();
  renderAnalytics();
  renderTimetable();
}

/* Events */
btnToggleAnalytics?.addEventListener("click", () => {
  analyticsOpen = !analyticsOpen;
  renderAnalyticsVisibility();
});

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
    tagIds: modalSelectedTagIds,
    locked: slotLockedInput.checked
  };

  applySlotPayload(applyScopeSelect.value, payload);
  closeModal();
});

btnDelete?.addEventListener("click", () => {
  if(activeDay == null || activeHour == null) return;
  deleteSlotByScope(applyScopeSelect.value);
  closeModal();
});

/* Day manager events */
btnCloseDayManager?.addEventListener("click", closeDayManager);
btnCloseDayManager2?.addEventListener("click", closeDayManager);
dayManagerOverlay?.addEventListener("click", (e) => {
  if(e.target === dayManagerOverlay) closeDayManager();
});
dayVariantSelect?.addEventListener("change", () => {
  if(!managedDay) return;
  switchActiveVariant(managedDay, dayVariantSelect.value, "manual");
  openDayManager(managedDay);
});
btnDuplicateVariant?.addEventListener("click", () => {
  if(!managedDay) return;
  duplicateCurrentVariantQuick(managedDay);
});
btnRenameVariant?.addEventListener("click", renameCurrentVariantFromManager);
btnDeleteVariant?.addEventListener("click", deleteCurrentVariantFromManager);
btnCopyDayNow?.addEventListener("click", copyDayFromManager);

/* Tools events */
btnOpenTools?.addEventListener("click", openTools);
btnCloseTools?.addEventListener("click", closeTools);
btnCloseTools2?.addEventListener("click", closeTools);
toolsOverlay?.addEventListener("click", (e) => {
  if(e.target === toolsOverlay) closeTools();
});

btnOpenTagManagerFromTools?.addEventListener("click", () => {
  closeTools();
  openTagManager();
});
btnOpenPresetManagerFromTools?.addEventListener("click", () => {
  closeTools();
  openPresetManager();
});

/* Tag manager events */
btnCloseTagManager?.addEventListener("click", closeTagManager);
btnCloseTagManager2?.addEventListener("click", closeTagManager);
tagManagerOverlay?.addEventListener("click", (e) => {
  if(e.target === tagManagerOverlay) closeTagManager();
});

/* Preset manager events */
btnCreatePreset?.addEventListener("click", createPresetFromCurrentPrompt);
presetSelect?.addEventListener("change", () => {
  if(presetSelect.value === "__custom__"){
    appData.activePresetId = null;
    saveData();
    render();
    return;
  }
  applyPreset(presetSelect.value);
});
btnClosePresetModal?.addEventListener("click", closePresetManager);
btnClosePresetModal2?.addEventListener("click", closePresetManager);
presetOverlay?.addEventListener("click", (e) => {
  if(e.target === presetOverlay) closePresetManager();
});
btnRenamePreset?.addEventListener("click", renameCurrentPresetFromModal);
btnDeletePreset?.addEventListener("click", deleteCurrentPresetFromModal);

/* Clear all */
btnClearAll?.addEventListener("click", () => {
  const ok = confirm("Clear all WeekWise data?");
  if(!ok) return;

  localStorage.removeItem(STORAGE_KEY_V5);
  localStorage.removeItem(LEGACY_KEY_V4);
  localStorage.removeItem(LEGACY_KEY_V3);
  localStorage.removeItem(LEGACY_KEY_V2);

  appData = normalizeAppData({
    tags: {},
    dayVariants: getDefaultVariantsState(),
    ...getDefaultPresetsState()
  });
  activeFilters = [];
  render();
  closeTools();
});

/* Boot */
render();
setInterval(render, 60 * 1000);