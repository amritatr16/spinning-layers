// SPIN-DISC GENERATOR (p5.js) - laser-cut templates
// SPACE  new random set of three layers      S  save SVG sheet for the laser
// Every pattern is a hole cut through the layer (red hairline in the SVG).
// All sizes are in millimetres.

const P = {
  layers: 3,
  diameter: 70,     // outer diameter of each disc (mm)
  hole: 6.2,        // axle hole (6 mm dowel + clearance)
  hubMargin: 4,     // solid material kept around the hole (mm)
  rimMargin: 3,     // solid rim kept at the edge (mm)
  minFeature: 1.6,  // smallest cut slot / bridge (mm). Raise it for MDF.
  gap: 6,           // spacing between discs on the export sheet (mm)
  margin: 5,        // sheet border (mm)
};

const TYPES = ['rings', 'slits', 'dots'];
const COLORS = ['#d9b27c']; // solid preview colour, same for every layer
const PRESET = null; // e.g. [{type:'slits',seed:42},{type:'rings',seed:7}] to reproduce a design

const K = 2, VD = 240; // preview resolution factor, preview disc size (px)
let layers = [], active = false; // active: keys only act while the pointer is over the sketch

// ---------- small SVG path helpers (coordinates are mm, origin = disc centre) ----------
const f = v => +v.toFixed(3);
const pt = (r, a) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
const C = d => ({ d, mode: 'cut' });
const pick = a => a[Math.floor(Math.random() * a.length)];

// annular sector (a filled "arc band") between radii r1..r2 and angles a1..a2
function sector(r1, r2, a1, a2) {
  const n = Math.max(1, Math.ceil((a2 - a1) / (Math.PI * 0.9)));
  const step = (a2 - a1) / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const s = a1 + i * step, e = s + step;
    d += `M${pt(r2, s)}A${f(r2)} ${f(r2)} 0 0 1 ${pt(r2, e)}L${pt(r1, e)}A${f(r1)} ${f(r1)} 0 0 0 ${pt(r1, s)}Z`;
  }
  return d;
}
const circ = (x, y, r) =>
  `M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)}Z`;

// ---------- pattern generators: each returns a list of shapes ----------

// Rings of dashes: each ring blends into a grey level equal to its duty cycle
function rings(rIn, rOut) {
  const S = [], n = floor(random(4, 8)), w = (rOut - rIn) / n;
  const smooth = random() < 0.6, dir = random() < 0.5;
  for (let i = 0; i < n; i++) {
    const r1 = rIn + i * w + P.minFeature / 2, r2 = rIn + (i + 1) * w - P.minFeature / 2;
    let duty = smooth ? (dir ? i / (n - 1) : 1 - i / (n - 1)) * 0.8 + 0.1 + random(-0.08, 0.08)
                      : random(0.1, 0.9);
    let m = floor(random(6, 40));
    while (m > 3 && (TWO_PI * r1) / m < 2.2 * P.minFeature) m--; // dash and bridge must both fit
    const seg = TWO_PI / m, ph = random(TWO_PI), arc = (TWO_PI * r1) / m;
    duty = constrain(duty, P.minFeature / arc, 1 - P.minFeature / arc);
    for (let k = 0; k < m; k++) S.push(C(sector(r1, r2, ph + k * seg, ph + k * seg + duty * seg)));
  }
  return S;
}

// Cut-through radial slots in 1-3 zones (stroboscopic flicker, moire when layers overlap)
function slits(rIn, rOut) {
  const S = [], zones = floor(random(1, 4)), mb = P.minFeature + 0.4;
  const th = (rOut - rIn - (zones - 1) * mb) / zones;
  const mod = random() < 0.4 ? random(0.2, 0.5) : 0, cyc = floor(random(1, 4));
  for (let z = 0; z < zones; z++) {
    const r1 = rIn + z * (th + mb), r2 = r1 + th;
    let n = random([6, 8, 10, 12, 16, 18, 20, 24, 30]);
    while (n > 3 && (r1 * TWO_PI) / n < P.minFeature + mb) n--; // slot + bridge must fit at inner radius
    const pitch = TWO_PI / n;
    const base = constrain(random(0.3, 0.65) * pitch, P.minFeature / r1, pitch - mb / r1);
    const ph = random(TWO_PI);
    for (let k = 0; k < n; k++) {
      const da = max(P.minFeature / r1, base * (1 - mod * (0.5 + 0.5 * Math.sin((k * cyc * TWO_PI) / n))));
      const a = ph + k * pitch;
      S.push(C(sector(r1, r2, a - da / 2, a + da / 2)));
    }
  }
  return S;
}

// Rings of dots (each ring blends to a grey set by dot size and density)
function dots(rIn, rOut) {
  const S = [], n = floor(random(3, 8)), pitch = (rOut - rIn) / n, sp = random(1.0, 1.6);
  const drop = random([0, 0, 0.15, 0.3]), grow = random() < 0.5, flip = random() < 0.5;
  for (let i = 0; i < n; i++) {
    const r = rIn + pitch * (i + 0.5), t = flip ? 1 - i / (n - 1) : i / (n - 1);
    const rd = constrain(pitch * (grow ? 0.15 + 0.27 * t : random(0.18, 0.42)), P.minFeature / 2, (pitch - P.minFeature) / 2);
    const m = floor((TWO_PI * r) / max(sp * pitch, 2 * rd + P.minFeature)), ph = (i % 2) * PI / m;
    for (let k = 0; k < m; k++) {
      if (random() >= drop) {
        const a = ph + (k * TWO_PI) / m;
        S.push(C(circ(r * Math.cos(a), r * Math.sin(a), rd)));
      }
    }
  }
  return S;
}

const GEN = { rings, slits, dots };

// ---------- build one layer: axle hole + pattern ----------
function build(L) {
  randomSeed(L.seed);
  const R = P.diameter / 2, rIn = P.hole / 2 + P.hubMargin, rOut = R - P.rimMargin;
  const S = [C(circ(0, 0, P.hole / 2)), ...GEN[L.type](rIn, rOut)];
  L.shapes = S;
}

function newAll() { // three different pattern types, random order, random seeds
  const types = [...TYPES].sort(() => Math.random() - 0.5);
  layers = Array.from({ length: P.layers }, (_, i) => ({ type: types[i], seed: Math.floor(Math.random() * 1e6) }));
  layers.forEach(build);
}

// ---------- preview: solid layers, patterns are holes ----------
function layerCanvas(i) {
  const px = VD * K, s = px / P.diameter, cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const c = cv.getContext('2d');
  c.translate(px / 2, px / 2);
  c.scale(s, s);
  c.fillStyle = COLORS[i % COLORS.length];
  c.beginPath(); c.arc(0, 0, P.diameter / 2, 0, TWO_PI); c.fill();
  c.globalCompositeOperation = 'destination-out'; // every shape is cut through
  for (const sh of layers[i].shapes) c.fill(new Path2D(sh.d));
  return cv;
}


// ---------- p5 ----------
function setup() {
  createCanvas(780, 330).parent('sketch-holder');
  const h = document.getElementById('sketch-holder'); h.tabIndex = 0;
  ['mouseenter', 'focus'].forEach(e => h.addEventListener(e, () => active = true));
  ['mouseleave', 'blur'].forEach(e => h.addEventListener(e, () => active = false));
  noLoop();
  if (PRESET) { layers = PRESET.map(p => ({ ...p })); layers.forEach(build); }
  else newAll();
}

function draw() {
  background(246);
  noStroke(); fill(40); textAlign(CENTER); textSize(12);
  const cvs = layers.map((_, i) => layerCanvas(i));
  cvs.forEach((cv, i) => {
    const x = 130 + i * 260;
    drawingContext.drawImage(cv, x - VD / 2, 20, VD, VD);
    text(`Layer ${i + 1} - ${layers[i].type} - seed ${layers[i].seed}`, x, 276);
  });
  textSize(11);
  text('SPACE new set | S save SVG', 390, 310);
}

function ui(k) { // used by the buttons on the page
  if (k === 's') saveSheet(); else newAll();
  redraw();
}
function keyPressed() {
  if (!active) return; // let the page scroll normally elsewhere
  const k = key.toLowerCase();
  if (k === ' ' || k === 's') { ui(k); return false; }
}

// ---------- export: one SVG sheet, discs side by side, true mm units ----------
function saveSheet() {
  const D = P.diameter, n = layers.length;
  const W = n * D + (n - 1) * P.gap + 2 * P.margin, H = D + 2 * P.margin;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n`;
  svg += `<desc>${layers.map((l, i) => `L${i + 1}:${l.type}:${l.seed}`).join(' ')} hole=${P.hole}mm</desc>\n`;
  layers.forEach((L, i) => {
    const cx = P.margin + D / 2 + i * (D + P.gap), cy = P.margin + D / 2;
    svg += `<g id="layer${i + 1}_${L.type}" transform="translate(${cx} ${cy})">\n`;
    svg += `<g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1"><circle r="${D / 2}"/>`;
    for (const s of L.shapes) if (s.mode === 'cut') svg += `<path d="${s.d}"/>`;
    svg += `</g></g>\n`;
  });
  svg += '</svg>';
  saveStrings([svg], 'spin-discs', 'svg');
}