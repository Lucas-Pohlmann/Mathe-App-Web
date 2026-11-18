// Oberfläche der Web-App – entspricht MainActivity.kt, HomeScreen.kt und MatrixScreen.kt.

import { MatrixGame, MAX } from "./game.js";
import { dotText } from "./dotfont.js";

// ---------------- Themen ----------------

/** Ein Übungsthema auf dem Startbildschirm. Weitere Themen können hier ergänzt werden. */
const TOPICS = [{ id: "matrix", number: "01", title: "Matrixmultiplikation", subtitle: "Produkt berechnen · Falk-Schema" }];

// ---------------- Zustand ----------------

const app = document.getElementById("app");
const game = new MatrixGame(safeStorage());
const ui = {
  screen: "home",
  showStats: false,
  enteredFromHome: false,
  // Für Einblend-Animationen: Was war beim letzten Zeichnen sichtbar?
  prevScreen: null,
  prevStep2: false,
  prevLocked: false,
};

function safeStorage() {
  try {
    const k = "__test__";
    localStorage.setItem(k, k);
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return undefined; // MatrixGame nutzt dann einen flüchtigen Speicher
  }
}

// ---------------- Haptik ----------------

let iosSwitch = null;

/** Kurzes haptisches Feedback: Vibration auf Android, Schalter-Trick ab iOS 18. */
function haptic(strong = false) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(strong ? 15 : 8);
    return;
  }
  // iOS-Safari kennt keine Vibration-API, löst aber beim Umschalten eines
  // <input switch> ein Haptik-Signal aus.
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
  if (!iosSwitch) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = "haptic-switch";
    iosSwitch = document.createElement("label");
    iosSwitch.htmlFor = input.id;
    iosSwitch.append(input);
    iosSwitch.style.display = "none";
    iosSwitch.setAttribute("aria-hidden", "true");
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

// ---------------- HTML-Bausteine ----------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const blink = (size) => `<span class="blink" style="width:${size}px;height:${size}px"></span>`;

function sectionHeader(number, title, trailing) {
  return `<div class="section-header">
    ${dotText(number, { dot: 2.5, gap: 1, color: "var(--red)" })}
    <span class="label title">${esc(title)}</span>
    ${trailing ? `<span class="label">${esc(trailing)}</span>` : ""}
  </div>`;
}

function pill(text, act, style = "red", extra = "") {
  return `<button class="pill ${style} ${extra}" data-act="${act}">${esc(text)}</button>`;
}

function feedbackBox(f) {
  return `<div class="feedback ${f.kind}" role="status">
    <span class="bullet"></span>
    <div>
      <div class="title">${esc(f.title)}</div>
      ${f.detail ? `<div class="detail">${esc(f.detail)}</div>` : ""}
    </div>
  </div>`;
}

const PAREN_L = `<span class="paren"><svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M9 1 C0.5 13 0.5 87 9 99"/></svg></span>`;
const PAREN_R = `<span class="paren"><svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M1 1 C9.5 13 9.5 87 1 99"/></svg></span>`;

/** Matrix zwischen runden Klammern. */
function matrixDisplay(m) {
  let cells = "";
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) cells += `<span>${m.get(r, c)}</span>`;
  return `<div class="matrix" role="img" aria-label="${esc(m.toMaxima())}">${PAREN_L}<div class="cells" style="grid-template-columns:repeat(${m.cols},auto)">${cells}</div>${PAREN_R}</div>`;
}

// ---------------- Startbildschirm ----------------

function homeScreen() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const topics = TOPICS.map(
    (t) => `<button class="card topic" data-act="open" data-arg="${t.id}">
      <div class="row">${dotText(t.number, { color: "var(--red)" })}<span>→</span></div>
      <div class="name">${esc(t.title)}</div>
      <div class="label sub">${esc(t.subtitle)}</div>
    </button>`,
  ).join("");
  return `<main class="screen home">
    <div class="logo">${dotText("MATHE", { dot: 7, gap: 2 })}${blink(12)}</div>
    <div style="margin-top:12px">${dotText("APP", { dot: 7, gap: 2, color: "var(--red)", off: "#1a1a1a" })}</div>
    <div class="label" style="margin-top:16px">Üben für die Uni</div>
    <div class="label" style="margin-top:48px;margin-bottom:12px">Themen</div>
    <div style="display:flex;flex-direction:column;gap:12px">${topics}</div>
    ${
      standalone
        ? ""
        : `<p class="label hint">Tipp: Über „Teilen → Zum Home-Bildschirm“ (iPhone) bzw. „App installieren“ (Android) läuft die App im Vollbild und offline.</p>`
    }
  </main>`;
}

// ---------------- Matrix-Aufgabe ----------------

function matrixScreen() {
  const step2Enter = game.step1Solved && !ui.prevStep2;
  return `<main class="screen">
    ${topBar()}
    ${givenMatrices()}
    ${step1Card()}
    ${game.step1Solved ? `<div class="${step2Enter ? "enter" : ""}">${step2Card()}</div>` : ""}
    ${pill("Neue Aufgabe  →", "newTask", game.locked ? "white" : "outline", "wide")}
  </main>
  ${ui.showStats ? statsDialog() : ""}`;
}

function topBar() {
  const stat = (value, label, color) => `<button class="stat" data-act="stats" aria-label="${label}: ${value}">
      ${dotText(String(value).padStart(2, "0"), { color, off: "#1e1e1e" })}
      <span class="label">${label}</span>
    </button>`;
  return `<header class="topbar">
    <button class="round" data-act="back" aria-label="Zurück">←</button>
    <div class="heading">
      <div class="row">${dotText("MATRIX", { dot: 2.5, gap: 1 })}${blink(7)}</div>
      <div class="label">Multiplikation</div>
    </div>
    ${stat(game.earned, "PUNKTE", "var(--white)")}
    ${stat(game.streak, "SERIE", "var(--red)")}
  </header>`;
}

function givenMatrices() {
  const cards = game.task.names
    .map((name) => {
      const m = game.task.get(name);
      const active = name === game.left || name === game.right;
      return `<div class="card ${active ? "active" : ""}">
        <div class="head">
          ${dotText(name, { color: active ? "var(--red)" : "var(--white)" })}
          <span class="label">${game.dimsRevealed ? m.dim : "?×?"}</span>
        </div>
        <div class="body">${matrixDisplay(m)}</div>
      </div>`;
    })
    .join("");
  return `<section>
    <div class="label" style="margin-bottom:10px">Gegeben seien die folgenden vier Matrizen</div>
    <div class="given">${cards}</div>
  </section>`;
}

function step1Card() {
  const chipRow = (label, side, value) => `<div class="chip-row">
      <span class="label">${label}</span>
      <div class="chips" role="radiogroup" aria-label="${label}">
        ${game.task.names
          .map((n) => {
            const on = n === value;
            return `<button class="chip ${on ? "on" : ""}" role="radio" aria-checked="${on}" data-act="${side}" data-arg="${n}" ${game.step1Solved ? "disabled" : ""}>
              ${dotText(n, { color: on ? "var(--black)" : "var(--white)" })}
            </button>`;
          })
          .join("")}
      </div>
    </div>`;
  return `<section class="card">
    ${sectionHeader("01", "Faktoren wählen", "1 Pkt")}
    <p class="text mt8">Wählen Sie zwei Matrizen, deren Produkt in der gewählten Reihenfolge definiert ist.</p>
    <div style="height:4px"></div>
    ${chipRow("Links", "left", game.left)}
    ${chipRow("Rechts", "right", game.right)}
    <div class="pick">
      ${dotText(`${game.left ?? "?"}·${game.right ?? "?"}`, { dot: 4, gap: 1.5 })}
      ${game.step1Solved ? "" : pill("Prüfen", "check1")}
    </div>
    ${game.step1Feedback ? `<div class="mt14">${feedbackBox(game.step1Feedback)}</div>` : ""}
  </section>`;
}

function step2Card() {
  const product = game.product;
  const explainEnter = game.locked && !ui.prevLocked;
  return `<section class="card" style="padding:14px">
    ${sectionHeader("02", "Produkt berechnen", "1 Pkt")}
    <p class="text mt8">Berechnen Sie das Produkt ${game.left}·${game.right} in genau dieser Reihenfolge. Tragen Sie das Ergebnis im Falk-Schema ein.</p>
    ${falkScheme()}
    <div class="preview">${esc(game.locked ? product.toMaxima() : game.answerPreview())}</div>
    ${
      game.locked
        ? ""
        : `${keypad()}
           <div class="actions">${pill("Prüfen", "check2")}${pill("Lösung", "reveal", "outline")}</div>`
    }
    ${game.feedback ? `<div class="mt14">${feedbackBox(game.feedback)}</div>` : ""}
    ${game.locked ? `<div class="mt14 ${explainEnter ? "enter" : ""}">${explainBox()}</div>` : ""}
  </section>`;
}

/**
 * Falk-Schema:
 *
 *            │  B
 *        ────┼─────
 *         A  │ A·B
 *
 * Rechts oben steht der rechte Faktor, links unten der linke, rechts unten wird das
 * Ergebnis eingetragen – jeder Eintrag im Schnittpunkt von Zeile i und Spalte j.
 */
function falkScheme() {
  const a = game.leftMatrix;
  const b = game.rightMatrix;
  const m = a.rows;
  const n = a.cols;
  const p = b.cols;
  const mark = game.locked; // Zeile/Spalte nur im Rechenweg markieren
  const selR = game.selectedRow;
  const selC = game.selectedCol;
  const product = game.product;
  const at = (row, col) => `grid-row:${row};grid-column:${col}`;
  let html = "";

  // Oben links: Beschriftung in der letzten Zeile des leeren Blocks
  html += `<div class="label corner" style="grid-row:${n};grid-column:1 / span ${n}">${game.left}·${game.right}</div>`;
  // Trennlinien
  html += `<div class="vline" style="grid-row:1 / -1;grid-column:${n + 1}"></div>`;
  html += `<div class="hline" style="grid-row:${n + 1};grid-column:1 / -1"></div>`;

  // Oben rechts: rechter Faktor
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < p; j++) {
      const hl = mark && j === selC;
      html += `<div class="val ${hl ? "hl" : ""}" style="${at(k + 1, n + 2 + j)}">${b.get(k, j)}</div>`;
    }
  }
  // Unten links: linker Faktor
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      const hl = mark && i === selR;
      html += `<div class="val ${hl ? "hl" : ""}" style="${at(n + 2 + i, k + 1)}">${a.get(i, k)}</div>`;
    }
  }
  // Unten rechts: Eingabe bzw. Ergebnis
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      const idx = i * MAX + j;
      const sel = idx === game.selected;
      const wrong = game.wrongCells.has(idx);
      let text;
      let state;
      if (game.solved) {
        text = product.get(i, j);
        state = "good";
      } else if (game.revealed) {
        text = product.get(i, j);
        state = wrong ? "wrong" : "good";
      } else {
        text = game.cells[idx] || (sel ? "_" : "");
        state = wrong ? "wrong" : "";
      }
      const cls = ["in", state, sel ? "sel" : "", sel && game.locked ? "locked" : ""].join(" ");
      html += `<button class="${cls}" style="${at(n + 2 + i, n + 2 + j)}" data-act="cell" data-arg="${idx}" aria-label="Zeile ${i + 1}, Spalte ${j + 1}: ${text === "" || text === "_" ? "leer" : text}">${esc(text)}</button>`;
    }
  }
  return `<div class="falk-wrap"><div class="falk" style="--n:${n};--p:${p};--m:${m}">${html}</div></div>`;
}

function explainBox() {
  const r = game.selectedRow;
  const c = game.selectedCol;
  const yours = game.userValue(r, c);
  const showYours = game.revealed && yours !== game.product.get(r, c);
  return `<div class="explain">
    <div class="label">Rechenweg (${r + 1},${c + 1}) · Feld antippen</div>
    <div class="calc">${esc(game.explainSelected())}</div>
    ${showYours ? `<div class="yours">Deine Eingabe: ${yours ?? "–"}</div>` : ""}
  </div>`;
}

function keypad() {
  const digit = (d) => `<button class="key" data-act="key" data-arg="${d}" aria-label="${d}">${dotText(String(d))}</button>`;
  const sym = (s, key, label) => `<button class="key sym" data-act="key" data-arg="${key}" aria-label="${label}">${s}</button>`;
  return `<div class="keypad">
    ${digit(1)}${digit(2)}${digit(3)}${sym("⌫", "back", "Löschen")}
    ${digit(4)}${digit(5)}${digit(6)}${sym("←", "prev", "Vorheriges Feld")}
    ${digit(7)}${digit(8)}${digit(9)}${sym("→", "next", "Nächstes Feld")}
    ${sym("±", "sign", "Vorzeichen")}${digit(0)}${sym("C", "clear", "Feld leeren")}${sym("AC", "clearAll", "Alles leeren")}
  </div>`;
}

function statsDialog() {
  const rate = game.possible === 0 ? 0 : Math.floor((game.earned * 100) / game.possible);
  const row = (label, value) => `<div class="stat-row"><span class="label">${label}</span><span>${value}</span></div>`;
  return `<div class="overlay" data-act="closeStats">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Statistik">
      ${dotText("STATISTIK")}
      <div class="rows">
        ${row("Punkte", `${game.earned} / ${game.possible}`)}
        ${row("Quote", `${rate} %`)}
        ${row("Aktuelle Serie", game.streak)}
        ${row("Beste Serie", game.bestStreak)}
        <p class="text" style="font-size:11px;line-height:16px">Ein Punkt pro Schritt, wenn er im ersten Versuch richtig ist. Die Serie zählt Aufgaben, bei denen beide Schritte auf Anhieb stimmen.</p>
      </div>
      <div class="buttons">
        <button class="danger" data-act="resetStats">ZURÜCKSETZEN</button>
        <button data-act="closeStats">SCHLIESSEN</button>
      </div>
    </div>
  </div>`;
}

// ---------------- Zeichnen ----------------

function render() {
  const screenChanged = ui.screen !== ui.prevScreen;
  // Fokus über das Neuzeichnen hinweg erhalten (Tastatur-Bedienung)
  const focused = document.activeElement?.closest?.("[data-act]");
  const focusKey = focused ? `${focused.dataset.act}|${focused.dataset.arg ?? ""}` : null;

  app.innerHTML = ui.screen === "matrix" ? matrixScreen() : homeScreen();

  // Die Bildschirm-Überblendung nur beim Wechsel abspielen
  if (!screenChanged) app.querySelector(".screen")?.style.setProperty("animation", "none");
  if (focusKey) {
    const [act, arg] = focusKey.split("|");
    const sel = `[data-act="${act}"]` + (arg ? `[data-arg="${CSS.escape(arg)}"]` : "");
    app.querySelector(sel)?.focus({ preventScroll: true });
  }

  ui.prevScreen = ui.screen;
  ui.prevStep2 = game.step1Solved;
  ui.prevLocked = game.locked;
}

// ---------------- Navigation (Zurück-Taste/-Geste des Browsers) ----------------

function screenFromHash() {
  return location.hash === "#matrix" ? "matrix" : "home";
}

window.addEventListener("hashchange", () => {
  ui.screen = screenFromHash();
  ui.showStats = false;
  window.scrollTo(0, 0);
  render();
});

function goHome() {
  if (ui.enteredFromHome) history.back();
  else location.hash = "";
}

// ---------------- Eingaben ----------------

const actions = {
  open(id) {
    ui.enteredFromHome = true;
    location.hash = id;
  },
  back: goHome,
  stats() {
    ui.showStats = true;
  },
  closeStats() {
    ui.showStats = false;
  },
  resetStats() {
    game.resetStats();
    ui.showStats = false;
  },
  left: (n) => game.selectLeft(n),
  right: (n) => game.selectRight(n),
  check1: () => game.checkStep1(),
  cell(idx) {
    const i = Number(idx);
    game.select(Math.floor(i / MAX), i % MAX);
  },
  key: (k) => game.input(k),
  check2: () => game.check(),
  reveal: () => game.reveal(),
  newTask() {
    game.newTask();
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  },
};

const STRONG = new Set(["check1", "check2", "reveal", "newTask", "open", "resetStats"]);

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  // Klick in den Dialog selbst schließt ihn nicht
  if (el.classList.contains("overlay") && e.target !== el) return;
  const act = el.dataset.act;
  if (!actions[act]) return;
  haptic(STRONG.has(act));
  actions[act](el.dataset.arg);
  if (act !== "open") render(); // "open" zeichnet über hashchange
});

// Hardware-/Desktop-Tastatur: Ziffern, Minus, Pfeile, Löschen, Enter
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (ui.showStats && e.key === "Escape") {
    ui.showStats = false;
    render();
    return;
  }
  if (ui.screen !== "matrix" || ui.showStats || !game.step1Solved || game.locked) return;
  const map = {
    Backspace: "back",
    Delete: "clear",
    "-": "sign",
    ArrowLeft: "prev",
    ArrowRight: "next",
  };
  const key = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
  if (e.key === "Enter") {
    e.preventDefault();
    game.check();
  } else if (key) {
    e.preventDefault();
    game.input(key);
  } else {
    return;
  }
  render();
});

// ---------------- Start ----------------

ui.screen = screenFromHash();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
