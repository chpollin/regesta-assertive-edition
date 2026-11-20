// Interface wording in German. Role tokens are never translated; they stand as delivered.

export const KIND = {
  actor: "Person oder Gruppe",
  place: "Ort",
  subject: "Sache",
  event: "Ereignis",
  parent: "Stichwort",
  unclassified: "Art nicht angegeben",
};

// Short words for the shape key of the figure.
export const KIND_KEY = {
  actor: "Person oder Gruppe",
  place: "Ort",
  subject: "Sache",
  event: "Ereignis",
  unclassified: "ohne Art",
};

// One phrase per export finding, in the reader's words. The delivered value follows it.
const FINDING = {
  TruncatedLabel: "Eintrag ohne Stichwort geliefert",
  ImplausibleCoordinate: "Koordinate außerhalb jedes möglichen Bereichs, keine Position gezeigt",
  UnparsableCoordinate: "Koordinate nicht lesbar, keine Position gezeigt",
  InvalidGeonames: "GeoNames-Kennung ungültig",
  GeonamesAsUrl: "GeoNames-Kennung als Adresse geliefert",
  BrokenRegisterType: "Art des Eintrags nicht lesbar",
  UnclassifiedRegisterType: "Art des Eintrags nicht angegeben",
  MissingRole: "Rollenangabe leer",
  DuplicateRegisterRow: "Registerzeile doppelt geliefert",
  AmbiguousRegestReference: "Registerzeile nennt eine Nummer, die zwei Regesten tragen, und gilt für beide",
  StartYearNotInDating: "Jahr des Maschinendatums steht nicht in der Datierung",
  ReversedInterval: "Enddatum liegt vor dem Anfangsdatum",
  DashAsPlace: "Strich statt Ort geliefert",
  BrokenMarkup: "Wort des Textes in spitzen Klammern geliefert und beim Bereinigen verloren",
  MisspeltTitle: "Titel verschrieben",
  DuplicateIdentifier: "Zwei Regesten tragen diese Nummer",
  LateAdditionWithoutUrn: "Später eingefügte Nummer ohne Austauschkennung und URN",
};

// A finding as one plain German sentence part: phrase and, where delivered, the value.
export function findingText(f) {
  const phrase = FINDING[f.findingType] || "Fehler im Export";
  const value = f.deliveredValue;
  if (value === undefined || value === null || value === "null" || f.findingType === "TruncatedLabel") return phrase;
  return `${phrase}, geliefert „${value}“`;
}

// A truncated label shows the delivered start, up to the first segment separator.
export function truncatedStart(f) {
  return String(f.deliveredValue || "").split(" // ")[0];
}

export const dayCount = (n) => (n === 1 ? "1 Regest" : `${n} Regesten`);
