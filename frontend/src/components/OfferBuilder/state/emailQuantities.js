// Which part gets which quantity from the enquiry email. An email often
// names 2-3 parts with their own quantities, so a quantity only goes to the
// part it clearly belongs to - by drawing / article number, else by name.
// Anything unclear (no match, two possible parts, two different quantities
// for one part) is left empty for the user rather than guessed.

const normId = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

// "5Q0 802 123 A" = "5Q0-802-123-A"; a short revision letter on one side
// still matches ("5Q0802123" = "5Q0802123A"), a shorter number does not
// ("123" is not "5Q0802123").
export const sameNumber = (a, b) => {
  const x = normId(a);
  const y = normId(b);
  if (x.length < 4 || y.length < 4) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.startsWith(short) && long.length - short.length <= 3;
};

const sameName = (a, b) => {
  const x = normName(a);
  const y = normName(b);
  return x.length >= 3 && x === y;
};

// KTL parts carry a drawing number, Powder parts an article number
const numbersOf = (part) => [part.drawingNo, part.customerArticleNo, part.osteksArticleNo].filter((v) => normId(v));
const namesOf = (part) => [part.name, part.description].filter((v) => normName(v));

// part id -> quantity. `single`: the upload had one drawing and the email
// names one part - then that quantity is meant for it, unless both carry
// a number and the numbers differ.
export function matchEmailQuantities(parts, emailParts, { single = false } = {}) {
  const wanted = (Array.isArray(emailParts) ? emailParts : [])
    .map((e) => ({ ...e, quantity: Math.round(Number(e?.quantity)) }))
    .filter((e) => e.quantity > 0);
  const found = new Map();
  const conflicts = new Set();
  const give = (part, quantity) => {
    if (found.has(part.id) && found.get(part.id) !== quantity) conflicts.add(part.id);
    found.set(part.id, quantity);
  };

  for (const e of wanted) {
    let hits = normId(e.drawingNo) ? parts.filter((p) => numbersOf(p).some((n) => sameNumber(n, e.drawingNo))) : [];
    if (!hits.length && normName(e.name)) hits = parts.filter((p) => namesOf(p).some((n) => sameName(n, e.name)));
    if (hits.length === 1) give(hits[0], e.quantity);
  }

  if (!found.size && single && wanted.length === 1 && parts.length === 1) {
    const [part] = parts;
    const [e] = wanted;
    const numbers = numbersOf(part);
    const contradicts = normId(e.drawingNo) && numbers.length && !numbers.some((n) => sameNumber(n, e.drawingNo));
    if (!contradicts) give(part, e.quantity);
  }

  conflicts.forEach((id) => found.delete(id));
  return found;
}
