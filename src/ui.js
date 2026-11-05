import { months, totals } from "./data.js";
export const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export function parseAmount(text) {
  let value = String(text).trim();
  if (value.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(value))
      throw Error("Tutarı 1250,50 biçiminde girin.");
    value = value.replaceAll(".", "").replace(",", ".");
  } else if (!/^-?\d+(?:\.\d+)?$/.test(value))
    throw Error("Geçerli bir tutar girin.");
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER / 100)
    throw Error("Tutar izin verilen aralığı aşıyor.");
  return n;
}
export function periodRows(db, year, month) {
  return db.statements
    .filter((s) => s.year === String(year) && s.month === month)
    .sort((a, b) => a.day - b.day);
}
export function shiftPeriod(year, month, delta) {
  const index = (Number(year) - 1) * 12 + months.indexOf(month) + delta;
  if (index < 0 || index >= 9999 * 12) return null;
  return {
    year: String(Math.floor(index / 12) + 1),
    month: months[index % 12],
  };
}
export function createUI(document) {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      use = document.createElementNS(svg.namespaceURI, "use");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#i-" + name);
    svg.append(use);
    return svg;
  };
  const button = (text, cls, action) => {
    const b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  };
  const empty = (
    title,
    description,
    action,
    label = "Ekstre ekle",
    glyph = "card",
  ) => {
    const box = el("div", "empty-state"),
      image = el("div", "empty-icon");
    image.append(icon(glyph));
    box.append(image, el("h3", "", title), el("p", "", description));
    if (action) box.append(button(label, "button secondary", action));
    return box;
  };
  const avatar = (name) =>
    el(
      "span",
      "card-avatar",
      name.trim().slice(0, 2).toLocaleUpperCase("tr-TR"),
    );
  function entries(target, rows, { edit, toggle, add, filtered = false }) {
    target.replaceChildren();
    if (!rows.length) {
      target.append(
        empty(
          filtered ? "Bu filtrede ekstre yok" : "Henüz bu ay kayıt yok",
          filtered
            ? "Başka bir ödeme durumu seçebilirsin."
            : "İlk ekstreni ekle; toplamlarını ve ödeme durumunu buradan izle.",
          filtered ? null : add,
        ),
      );
      return;
    }
    for (const s of rows) {
      const row = el("article", "entry-row"),
        text = el("div"),
        right = el("div", "entry-right"),
        actions = el("div", "entry-actions");
      text.append(
        el("div", "entry-name", s.card),
        el("p", "entry-detail", `${s.day} ${s.month} ${s.year}`),
      );
      right.append(el("div", "entry-amount", money(s.amount)));
      const paid = button(
        s.isPaid ? "Ödendi" : "Bekliyor",
        "paid-chip" + (s.isPaid ? " is-paid" : ""),
        () => toggle(s),
      );
      paid.setAttribute(
        "aria-label",
        `${s.card}: ${s.isPaid ? "ödenmedi" : "ödendi"} olarak işaretle`,
      );
      paid.setAttribute("aria-pressed", String(s.isPaid));
      const editButton = button("", "icon-button", () => edit(s));
      editButton.setAttribute("aria-label", s.card + " ekstresini düzenle");
      editButton.append(icon("edit"));
      actions.append(paid, editButton);
      right.append(actions);
      row.append(avatar(s.card), text, right);
      target.append(row);
    }
  }
  function cards(target, db, rows, add, open) {
    target.replaceChildren();
    if (!db.cards.length) {
      target.append(
        empty(
          "Henüz kart eklenmedi",
          "Kartına bir isim vererek başla. Kart numarası veya banka bağlantısı gerekmez.",
          add,
          "İlk kartını ekle",
        ),
      );
      return;
    }
    for (const name of db.cards) {
      const card = el("article", "mini-card"),
        top = el("div", "mini-card-top"),
        statement = rows.find((s) => s.card === name);
      top.append(avatar(name), icon("card"));
      card.append(
        top,
        el("p", "name", name),
        el("div", "amount", statement ? money(statement.amount) : "—"),
        el(
          "small",
          "",
          statement
            ? statement.isPaid
              ? "Bu ay ödendi"
              : "Ödeme bekliyor"
            : "Bu ay ekstre eklenmedi",
        ),
      );
      const action = button(
        statement ? "Ekstreyi düzenle" : "Ekstre ekle",
        "text-button",
        () => open(statement, name),
      );
      action.append(icon("arrow"));
      card.append(action);
      target.append(card);
    }
  }
  function monthTiles(target, db, year, selected, choose) {
    const values = totals(db, year);
    target.replaceChildren(
      ...months.map((m, i) => {
        const b = button("", "month-tile", () => choose(m));
        b.setAttribute("aria-pressed", String(m === selected));
        b.append(
          el("strong", "", m),
          el("span", "", money(values[i])),
          el(
            "small",
            "",
            db.statements.filter((s) => s.year === year && s.month === m)
              .length + " ekstre",
          ),
        );
        return b;
      }),
    );
  }
  function driveFiles(target, files, restore, remove) {
    target.replaceChildren();
    if (!files.length) {
      target.append(
        empty(
          "Drive’da henüz yedek yok",
          "İlk yedeğini “Şimdi yedekle” ile oluşturabilirsin.",
          null,
          "",
          "cloud",
        ),
      );
      return;
    }
    for (const file of files) {
      const row = el("article", "drive-file"),
        actions = el("div", "action-grid");
      row.append(
        el("strong", "", file.name),
        el("p", "", new Date(file.createdTime).toLocaleString("tr-TR")),
      );
      actions.append(
        button("Bu yedeği geri yükle", "button secondary", () => restore(file)),
        button("Sil", "text-button", () => remove(file)),
      );
      row.append(actions);
      target.append(row);
    }
  }
  return { el, icon, empty, entries, cards, monthTiles, driveFiles };
}
