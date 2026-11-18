// Mathematisches Modell – 1:1 zu model/Matrix.kt und model/MatrixTask.kt der Android-App.

/** Unveränderliche Ganzzahl-Matrix. */
export class Matrix {
  constructor(rows, cols, data) {
    if (!(rows > 0 && cols > 0)) throw new Error("Dimension muss positiv sein");
    if (data.length !== rows * cols) throw new Error("Datenlänge passt nicht zur Dimension");
    this.rows = rows;
    this.cols = cols;
    this.data = Object.freeze([...data]);
  }

  get(r, c) {
    return this.data[r * this.cols + c];
  }

  /** Das Produkt this · other ist genau dann definiert, wenn Spalten(this) = Zeilen(other). */
  canMultiply(other) {
    return this.cols === other.rows;
  }

  times(other) {
    if (!this.canMultiply(other)) throw new Error(`Produkt nicht definiert: ${this.dim} · ${other.dim}`);
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < other.cols; c++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) sum += this.get(r, k) * other.get(k, c);
        out.push(sum);
      }
    }
    return new Matrix(this.rows, other.cols, out);
  }

  get dim() {
    return `${this.rows}×${this.cols}`;
  }

  /** Darstellung im Maxima-Format, z. B. matrix([10,16],[-17,-15]). */
  toMaxima() {
    const rows = [];
    for (let r = 0; r < this.rows; r++) {
      const vals = [];
      for (let c = 0; c < this.cols; c++) vals.push(this.get(r, c));
      rows.push(`[${vals.join(",")}]`);
    }
    return `matrix(${rows.join(",")})`;
  }

  equals(other) {
    return (
      other instanceof Matrix &&
      this.rows === other.rows &&
      this.cols === other.cols &&
      this.data.every((v, i) => v === other.data[i])
    );
  }

  toString() {
    return this.toMaxima();
  }

  static of(...rows) {
    if (rows.length === 0) throw new Error("Mindestens eine Zeile nötig");
    const cols = rows[0].length;
    if (!rows.every((r) => r.length === cols)) throw new Error("Alle Zeilen müssen gleich lang sein");
    return new Matrix(rows.length, cols, rows.flat());
  }

  /** Zufällige Matrix mit Einträgen in [min, max]. */
  static random(rows, cols, min, max, rnd = Math.random) {
    const data = Array.from({ length: rows * cols }, () => randInt(min, max, rnd));
    return new Matrix(rows, cols, data);
  }

  /**
   * Rechenweg für Eintrag (i, j) des Produkts l · r, z. B.
   * "1·4 + 3·4 + 2·(-3) = 10".
   */
  static explainEntry(l, r, i, j) {
    const f = (v) => (v < 0 ? `(${v})` : `${v}`);
    const terms = [];
    for (let k = 0; k < l.cols; k++) terms.push(`${f(l.get(i, k))}·${f(r.get(k, j))}`);
    return `${terms.join(" + ")} = ${l.times(r).get(i, j)}`;
  }
}

/** Ganzzahl in [min, max] (beide inklusive). */
export function randInt(min, max, rnd = Math.random) {
  return min + Math.floor(rnd() * (max - min + 1));
}

export const NAMES = ["A", "B", "C", "D"];
export const MAX_DIM = 4;

/** Eine Aufgabe: vier benannte Matrizen A–D, von denen manche Paare multiplizierbar sind. */
export class MatrixTask {
  /** @param {Record<string, Matrix>} matrices */
  constructor(matrices) {
    this.matrices = matrices;
  }

  get names() {
    return Object.keys(this.matrices);
  }

  get(name) {
    return this.matrices[name];
  }

  /** Alle geordneten Paare [links, rechts] verschiedener Matrizen, deren Produkt definiert ist. */
  get validPairs() {
    const pairs = [];
    for (const l of this.names) {
      for (const r of this.names) {
        if (r !== l && this.get(l).canMultiply(this.get(r))) pairs.push([l, r]);
      }
    }
    return pairs;
  }

  /**
   * Erzeugt vier zufällige Matrizen (2×2 bis 4×4, Einträge -4..4) wie in der Vorlage.
   * Es gibt immer mindestens ein und höchstens drei gültige Paare, damit die
   * Auswahl nicht trivial ist.
   */
  static generate(rnd = Math.random, min = -4, max = 4) {
    for (;;) {
      const matrices = {};
      for (const n of NAMES) {
        matrices[n] = Matrix.random(randInt(2, MAX_DIM, rnd), randInt(2, MAX_DIM, rnd), min, max, rnd);
      }
      const task = new MatrixTask(matrices);
      const count = task.validPairs.length;
      if (count >= 1 && count <= 3) return task;
    }
  }
}
