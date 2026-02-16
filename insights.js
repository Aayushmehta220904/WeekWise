const STORAGE_KEY = "WEEKWISE_SLOTS_V2";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function isWeekend(dayName){
  return dayName === "Saturday" || dayName === "Sunday";
}
function buildHoursForDay(dayName){
  const start = isWeekend(dayName) ? 8 : 20;
  const end = 24;
  const hours = [];
  for(let h=start; h<end; h++) hours.push(h);
  return hours;
}
function slotId(dayName, hour){
  return `${dayName}__${hour}`;
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

function loadSlots(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

const slots = loadSlots();

/* ===== scoring ===== */
const POINTS = { study: 2, essential: 1, nonessential: -1, empty: 0 };

function getDayStats(dayName){
  const hours = buildHoursForDay(dayName);
  let counts = { study:0, essential:0, nonessential:0, empty:0 };
  let raw = 0;
  let filled = 0;

  for(const h of hours){
    const s = slots[slotId(dayName, h)];
    const type = s?.type || "empty";
    counts[type] = (counts[type] || 0) + 1;
    raw += (POINTS[type] ?? 0);
    if(type !== "empty") filled++;
  }

  const max = filled * 2; // best possible if all filled are study
  let score = 0;
  if(max > 0){
    score = Math.round((raw / max) * 100);
    score = clamp(score, 0, 100);
  }
  return { counts, raw, filled, score, totalSlots: hours.length };
}

function getWeekStats(){
  let totalCounts = { study:0, essential:0, nonessential:0, empty:0 };
  let scores = [];
  let filledTotal = 0;

  DAYS.forEach(d => {
    const st = getDayStats(d);
    scores.push(st.score);
    filledTotal += st.filled;
    for(const k of Object.keys(totalCounts)){
      totalCounts[k] += st.counts[k] || 0;
    }
  });

  const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

  return { totalCounts, scores, avgScore, filledTotal };
}

/* ===== Render summary cards ===== */
const summaryStats = document.getElementById("summaryStats");
const { totalCounts, scores, avgScore, filledTotal } = getWeekStats();

if(summaryStats){
  summaryStats.innerHTML = `
    <div class="stat"><div class="k">Average Score</div><div class="v">${avgScore}/100</div></div>
    <div class="stat"><div class="k">Filled Slots</div><div class="v">${filledTotal}</div></div>
    <div class="stat"><div class="k">Study Slots</div><div class="v">${totalCounts.study}</div></div>
    <div class="stat"><div class="k">Essential Breaks</div><div class="v">${totalCounts.essential}</div></div>
    <div class="stat"><div class="k">Non-Essential Breaks</div><div class="v">${totalCounts.nonessential}</div></div>
    <div class="stat"><div class="k">Empty Slots</div><div class="v">${totalCounts.empty}</div></div>
  `;
}

/* ===== Canvas helpers ===== */
function setupCanvas(canvas){
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(canvas.height * dpr);
  ctx.scale(dpr, dpr);
  return ctx;
}

function clear(ctx, w, h){
  ctx.clearRect(0,0,w,h);
}

/* ===== Animated Bar Chart: Scores ===== */
const scoreCanvas = document.getElementById("scoreChart");
if(scoreCanvas){
  const ctx = setupCanvas(scoreCanvas);
  const w = scoreCanvas.getBoundingClientRect().width;
  const h = scoreCanvas.height;

  const padding = 30;
  const chartW = w - padding*2;
  const chartH = h - padding*2;

  const maxVal = 100;
  const bars = DAYS.map((d, i) => ({ label: d.slice(0,3), value: scores[i] }));

  let t = 0;
  function draw(){
    t = Math.min(t + 0.04, 1);

    clear(ctx, w, h);

    // axes
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding+chartH);
    ctx.lineTo(padding+chartW, padding+chartH);
    ctx.stroke();

    const barGap = 10;
    const barW = (chartW - barGap*(bars.length-1)) / bars.length;

    bars.forEach((b, i) => {
      const x = padding + i*(barW + barGap);
      const targetH = (b.value / maxVal) * chartH;
      const animH = targetH * (0.15 + 0.85 * t);

      // bar fill (no fixed color per requirement? user didn't restrict here; using neutral ink w/ alpha)
      ctx.fillStyle = "rgba(0,0,0,.20)";
      ctx.fillRect(x, padding + chartH - animH, barW, animH);

      // value
      ctx.fillStyle = "rgba(0,0,0,.80)";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(`${b.value}`, x + 6, padding + chartH - animH - 6);

      // label
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.fillText(b.label, x + 6, padding + chartH + 16);
    });

    // title hint line
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("0 — 100 score per day", padding, 18);

    if(t < 1) requestAnimationFrame(draw);
  }
  draw();
}

/* ===== Animated Mix Chart (Stacked Bars) ===== */
const mixCanvas = document.getElementById("mixChart");
if(mixCanvas){
  const ctx = setupCanvas(mixCanvas);
  const w = mixCanvas.getBoundingClientRect().width;
  const h = mixCanvas.height;

  const padding = 30;
  const chartW = w - padding*2;
  const chartH = h - padding*2;

  // totals
  const total = totalCounts.study + totalCounts.essential + totalCounts.nonessential + totalCounts.empty || 1;

  const segments = [
    { label:"Study", value: totalCounts.study },
    { label:"Essential", value: totalCounts.essential },
    { label:"NonEssential", value: totalCounts.nonessential },
    { label:"Empty", value: totalCounts.empty }
  ];

  let t = 0;
  function draw(){
    t = Math.min(t + 0.04, 1);
    clear(ctx, w, h);

    // axis baseline
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartH);
    ctx.lineTo(padding + chartW, padding + chartH);
    ctx.stroke();

    // stacked bar (single)
    const barX = padding;
    const barY = padding + chartH/2 - 18;
    const barH = 36;

    let xCursor = barX;
    segments.forEach((s, idx) => {
      const width = (s.value / total) * chartW;
      const animW = width * (0.15 + 0.85*t);

      // varying alpha shades to separate segments
      ctx.fillStyle = `rgba(0,0,0,${0.10 + idx*0.08})`;
      ctx.fillRect(xCursor, barY, animW, barH);

      // label
      if(animW > 40){
        ctx.fillStyle = "rgba(0,0,0,.75)";
        ctx.font = "12px ui-monospace, monospace";
        ctx.fillText(`${s.label}: ${s.value}`, xCursor + 10, barY + 22);
      }

      xCursor += width;
    });

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("Weekly slot distribution", padding, 18);

    if(t < 1) requestAnimationFrame(draw);
  }
  draw();
}