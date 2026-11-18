// Zustand und Regeln der Aufgabe – entspricht MatrixViewModel.kt der Android-App.
// Ohne DOM, damit es mit `node --test` geprüft werden kann.

import { Matrix, MatrixTask, MAX_DIM } from "./matrix.js";

export const MAX = MAX_DIM;

const STATS_KEY = "stats_matrix";

/** Speicher, falls localStorage fehlt (z. B. in Tests oder im privaten Modus). */
export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

export class MatrixGame {
  constructor(storage = memoryStorage(), rnd = Math.random) {
    this.storage = storage;
    this.rnd = rnd;
    const s = this.#load();
    this.earned = s.earned;
    this.possible = s.possible;
    this.streak = s.streak;
    this.bestStreak = s.bestStreak;
    this.newTask();
  }

  // ---------- Abgeleitete Werte ----------

  get leftMatrix() {
    return this.left ? this.task.get(this.left) : null;
  }

  get rightMatrix() {
    return this.right ? this.task.get(this.right) : null;
  }

  /** Produkt der gewählten Faktoren – erst nach gelöstem Schritt 1 vorhanden. */
  get product() {
    return this.step1Solved ? this.leftMatrix.times(this.rightMatrix) : null;
  }

  get rows() {
    return this.product?.rows ?? 1;
  }

  get cols() {
    return this.product?.cols ?? 1;
  }

  get locked() {
    return this.solved || this.revealed;
  }

  get selectedRow() {
    return Math.floor(this.selected / MAX);
  }

  get selectedCol() {
    return this.selected % MAX;
  }

  // ---------- Schritt 1: Faktoren wählen ----------

  selectLeft(n) {
    if (this.step1Solved) return;
    this.left = n;
    if (this.step1Feedback?.kind !== "wrong") this.step1Feedback = null;
  }

  selectRight(n) {
    if (this.step1Solved) return;
    this.right = n;
    if (this.step1Feedback?.kind !== "wrong") this.step1Feedback = null;
  }

  checkStep1() {
    const l = this.left;
    const r = this.right;
    if (!l || !r) {
      this.step1Feedback = { kind: "hint", title: "Bitte linken und rechten Faktor wählen." };
      return;
    }
    if (l === r) {
      this.step1Feedback = { kind: "hint", title: "Bitte zwei verschiedene Matrizen wählen." };
      return;
    }
    const ml = this.task.get(l);
    const mr = this.task.get(r);
    const ok = ml.canMultiply(mr);
    if (!this.step1Attempted) {
      this.step1Attempted = true;
      this.step1FirstTry = ok;
      this.#award(ok);
      if (!ok) this.#resetStreak();
    }
    this.dimsRevealed = true;
    if (ok) {
      this.step1Solved = true;
      this.step1Feedback = {
        kind: "ok",
        title: `Richtig – ${l}·${r} ist definiert.`,
        detail: `${l} ist ${ml.dim}, ${r} ist ${mr.dim}.\nSpalten(${l}) = ${ml.cols} = Zeilen(${r}) = ${mr.rows}`,
      };
    } else {
      this.step1Wrong++;
      const extra =
        this.step1Wrong >= 2
          ? "\nMögliche Paare: " + this.task.validPairs.map(([a, b]) => `${a}·${b}`).join(", ")
          : "\nRegel: Spaltenzahl links = Zeilenzahl rechts.";
      this.step1Feedback = {
        kind: "wrong",
        title: `Falsch – ${l}·${r} ist nicht definiert.`,
        detail: `${l} ist ${ml.dim}, ${r} ist ${mr.dim}.\nSpalten(${l}) = ${ml.cols} ≠ Zeilen(${r}) = ${mr.rows}` + extra,
      };
    }
  }

  // ---------- Schritt 2: Produkt im Falk-Schema berechnen ----------

  /** Auch nach dem Lösen erlaubt – dann zeigt die Auswahl den Rechenweg. */
  select(r, c) {
    this.selected = r * MAX + c;
  }

  /**
   * Tasten: "0"–"9", "sign", "back", "clear", "clearAll", "prev", "next".
   */
  input(key) {
    if (this.locked) return;
    const i = this.selected;
    const s = this.cells[i];
    if (/^[0-9]$/.test(key)) {
      const neg = s.startsWith("-");
      const digits = neg ? s.slice(1) : s;
      const nd = digits === "0" ? key : digits + key;
      if (nd.length <= 3) this.cells[i] = (neg ? "-" : "") + nd;
    } else if (key === "sign") {
      this.cells[i] = s.startsWith("-") ? s.slice(1) : "-" + s;
    } else if (key === "back") {
      this.cells[i] = s.slice(0, -1);
    } else if (key === "clear") {
      this.cells[i] = "";
    } else if (key === "clearAll") {
      this.cells.fill("");
      this.wrongCells = new Set();
      this.selected = 0;
    } else if (key === "next") {
      this.#moveSelection(+1);
    } else if (key === "prev") {
      this.#moveSelection(-1);
    }
    if (key !== "next" && key !== "prev") {
      this.wrongCells.delete(i);
      if (this.feedback?.kind === "hint") this.feedback = null;
    }
  }

  visibleIndices() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) out.push(r * MAX + c);
    return out;
  }

  #moveSelection(delta) {
    const vis = this.visibleIndices();
    const pos = Math.max(0, vis.indexOf(this.selected));
    this.selected = vis[(pos + delta + vis.length) % vis.length];
  }

  /** Aktuelle Eingabe im Maxima-Format (leere Felder als _). */
  answerPreview() {
    const rows = [];
    for (let r = 0; r < this.rows; r++) {
      const vals = [];
      for (let c = 0; c < this.cols; c++) vals.push(this.cells[r * MAX + c] || "_");
      rows.push(`[${vals.join(",")}]`);
    }
    return `matrix(${rows.join(",")})`;
  }

  userValue(r, c) {
    return parseCell(this.cells[r * MAX + c]);
  }

  check() {
    const product = this.product;
    if (!product || this.locked) return;
    const vis = this.visibleIndices();
    if (vis.some((i) => parseCell(this.cells[i]) === null)) {
      this.feedback = { kind: "hint", title: "Bitte alle Felder ausfüllen." };
      return;
    }
    const wrong = new Set(vis.filter((i) => parseCell(this.cells[i]) !== product.get(Math.floor(i / MAX), i % MAX)));
    const ok = wrong.size === 0;
    if (!this.attempted) {
      this.attempted = true;
      this.#award(ok);
      if (ok && this.step1FirstTry) this.#incrementStreak();
      else this.#resetStreak();
    }
    this.wrongCells = wrong;
    if (ok) {
      this.solved = true;
      this.feedback = { kind: "ok", title: "Richtig – sehr gut!", detail: `${this.left}·${this.right} = ${product.toMaxima()}` };
    } else {
      this.selected = Math.min(...wrong);
      this.feedback = {
        kind: "wrong",
        title: `${wrong.size} von ${vis.length} Einträgen falsch.`,
        detail: `Eintrag (i, j) = Zeile i von ${this.left} · Spalte j von ${this.right}.\nRot markierte Felder prüfen.`,
      };
    }
  }

  reveal() {
    const product = this.product;
    if (!product || this.locked) return;
    if (!this.attempted) {
      this.attempted = true;
      this.#award(false);
      this.#resetStreak();
    }
    // Falsche bzw. leere Felder merken, damit sie in der Lösung rot erscheinen
    this.wrongCells = new Set(
      this.visibleIndices().filter((i) => parseCell(this.cells[i]) !== product.get(Math.floor(i / MAX), i % MAX)),
    );
    this.revealed = true;
    this.feedback = null;
  }

  explainSelected() {
    return Matrix.explainEntry(this.leftMatrix, this.rightMatrix, this.selectedRow, this.selectedCol);
  }

  newTask() {
    this.task = MatrixTask.generate(this.rnd);
    this.left = null;
    this.right = null;
    this.step1Feedback = null;
    this.step1Solved = false;
    this.dimsRevealed = false;
    this.step1Attempted = false;
    this.step1FirstTry = false;
    this.step1Wrong = 0;
    this.cells = Array(MAX * MAX).fill("");
    this.selected = 0;
    this.wrongCells = new Set();
    this.feedback = null;
    this.solved = false;
    this.revealed = false;
    this.attempted = false;
  }

  // ---------- Statistik ----------

  resetStats() {
    this.earned = 0;
    this.possible = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.#save();
  }

  /** Je ein Punkt für Schritt 1 und Schritt 2; es zählt nur der erste Versuch. */
  #award(ok) {
    this.possible++;
    if (ok) this.earned++;
    this.#save();
  }

  /** Serie: Aufgaben, bei denen beide Schritte im ersten Versuch richtig waren. */
  #incrementStreak() {
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    this.#save();
  }

  #resetStreak() {
    this.streak = 0;
    this.#save();
  }

  #load() {
    const zero = { earned: 0, possible: 0, streak: 0, bestStreak: 0 };
    try {
      const raw = this.storage.getItem(STATS_KEY);
      if (!raw) return zero;
      const s = JSON.parse(raw);
      const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
      return { earned: n(s.earned), possible: n(s.possible), streak: n(s.streak), bestStreak: n(s.bestStreak) };
    } catch {
      return zero;
    }
  }

  #save() {
    const { earned, possible, streak, bestStreak } = this;
    try {
      this.storage.setItem(STATS_KEY, JSON.stringify({ earned, possible, streak, bestStreak }));
    } catch {
      // Speicher voll oder gesperrt – Statistik bleibt dann nur für diese Sitzung erhalten.
    }
  }
}

/** "12" → 12, "-3" → -3, "" oder "-" → null. */
export function parseCell(s) {
  return /^-?\d+$/.test(s) ? Number(s) : null;
}
