export const months = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
export const empty = () => ({ cards: [], statements: [] });
const key = (s) => JSON.stringify([s.card, String(s.year), s.month]);
export function validate(input) {
  let d =
    typeof input === "string"
      ? JSON.parse(input.replace(/^\uFEFF/, ""))
      : input;
  if (
    d &&
    typeof d === "object" &&
    ("cc_tracker_v8" in d || "cc_tracker_v7" in d)
  )
    d = d.cc_tracker_v8 ?? d.cc_tracker_v7;
  if (typeof d === "string") d = JSON.parse(d);
  if (!d || !Array.isArray(d.cards) || !Array.isArray(d.statements))
    throw Error("Kart ve ekstre listeleri eksik.");
  if (d.cards.length > 1000 || d.statements.length > 100000)
    throw Error("Yedek çok büyük.");
  const cards = d.cards.map((c) => {
    if (typeof c !== "string" || !c.trim() || c.length > 200)
      throw Error("Geçersiz kart adı.");
    return c;
  });
  if (new Set(cards).size !== cards.length) throw Error("Yinelenen kart adı.");
  const seen = new Map();
  for (const s of d.statements) {
    if (
      !s ||
      !cards.includes(s.card) ||
      !/^[1-9]\d{0,3}$/.test(String(s.year)) ||
      !months.includes(s.month) ||
      typeof s.amount !== "number" ||
      !Number.isFinite(s.amount) ||
      Math.abs(s.amount) > Number.MAX_SAFE_INTEGER / 100 ||
      !Number.isInteger(s.day) ||
      s.day < 1 ||
      s.day > 31 ||
      typeof s.isPaid !== "boolean"
    )
      throw Error("Geçersiz veya eksik ekstre alanı.");
    const normalized = {
      card: s.card,
      year: String(s.year),
      month: s.month,
      amount: s.amount,
      day: s.day,
      isPaid: s.isPaid,
    };
    const k = key(normalized);
    if (
      seen.has(k) &&
      JSON.stringify(seen.get(k)) !== JSON.stringify(normalized)
    )
      throw Error("Yedek içinde çelişen mükerrer ekstre var.");
    seen.set(k, normalized);
  }
  return { cards, statements: [...seen.values()] };
}
export async function merge(current, incoming, resolve) {
  const a = validate(current),
    b = validate(incoming);
  const result = {
    cards: [...new Set([...a.cards, ...b.cards])],
    statements: structuredClone(a.statements),
  };
  for (const s of b.statements) {
    const i = result.statements.findIndex((v) => key(v) === key(s));
    if (i < 0) result.statements.push(s);
    else if (JSON.stringify(result.statements[i]) !== JSON.stringify(s)) {
      const choice = await resolve(result.statements[i], s);
      if (choice === "cancel") throw Error("Aktarım iptal edildi.");
      if (choice === "incoming") result.statements[i] = s;
    }
  }
  return validate(result);
}
// Tek anahtarın atomik yazımı: veri ve aktarım öncesi güvenlik kopyası aynı işlemde saklanır.
export class Store {
  constructor(adapter) {
    this.adapter = adapter;
    this.queue = Promise.resolve();
    this.state = {
      data: empty(),
      safety: null,
      revision: 0,
      pending: false,
      auto: false,
      lastBackup: null,
    };
  }
  write(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  async load() {
    const raw = await this.adapter.get("kart_takip_state_v1");
    if (raw !== null && raw !== undefined) {
      const v = JSON.parse(raw);
      v.data = validate(v.data);
      if (v.safety) v.safety = validate(v.safety);
      this.state = v;
    }
    return structuredClone(this.state.data);
  }
  async commit(data, { safety = false, reset = false, ...meta } = {}) {
    const validated = validate(data);
    return this.write(async () => {
      const next = {
        ...this.state,
        ...meta,
        data: validated,
        revision: this.state.revision + 1,
        pending: true,
      };
      if (safety) next.safety = structuredClone(this.state.data);
      if (reset) {
        next.safety = null;
        next.auto = false;
        next.pending = false;
      }
      await this.adapter.set("kart_takip_state_v1", JSON.stringify(next));
      this.state = next;
      return structuredClone(next.data);
    });
  }
  async metadata(meta) {
    return this.write(async () => {
      const next = {
        ...this.state,
        ...(typeof meta === "function" ? meta(this.state) : meta),
      };
      await this.adapter.set("kart_takip_state_v1", JSON.stringify(next));
      this.state = next;
    });
  }
}
export function upsert(db, entry) {
  const d = structuredClone(db),
    i = d.statements.findIndex((s) => key(s) === key(entry));
  if (i < 0) d.statements.push(entry);
  else d.statements[i] = { ...entry, isPaid: d.statements[i].isPaid };
  return validate(d);
}
export function totals(db, year) {
  return months.map((m) =>
    db.statements
      .filter((s) => String(s.year) === String(year) && s.month === m)
      .reduce((v, s) => v + s.amount, 0),
  );
}
