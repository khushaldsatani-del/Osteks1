// German - the original wording of the sheets and the offer letters.
const de = {
  app: {
    title: "Angebot erstellen",
    subtitle: "KTL- und Pulverangebote mit Excel-Kalkulation",
    docTitle: "Angebot erstellen · Vorschau",
  },
  shell: {"openMenu": "Menü öffnen", "closeMenu": "Menü schließen", "menu": "Hauptmenü", "workPlace": "Arbeitsplatz", "allDocuments": "Alle Dokumente", "testReport": "Prüfbericht", "eightD": "8D-Report", "shiftPlanning": "Schichtplanung", "productionView": "Produktionsübersicht", "normLibrary": "Normbibliothek"},
  form: {"moreValues": "Weitere Werte", "changed": "{n} geändert", "useFromWeight": "Aus Gewicht übernehmen: {value}", "useFromWeightPulver": "Aus Gewicht übernehmen: {cm2} cm² ({mm2} mm²)", "notInPrice": "zur Info – nicht im Preis"},
  price: {"calculated": "Kalkulierter Preis / Stk.", "excel": {"base": "Preis pro Teil", "pickling": "Beizen (25ct/m²)", "masking": "Maskierung pro Teil [0,10ct/Teil]", "casting": "Gußzuschlag", "sum": "Summe", "etz": "zzgl. ETZ (Januar 2024)", "total": "Summe/Teil nach alter Kalkulation", "offerPrice": "Angebotspreis"}, "details": "Kalkulation im Detail", "pulverExcel": {"withoutMaterial": "Preis ohne Material", "material": "Materialeinsatz", "withMaterial": "Preis mit Material", "etz": "zzgl. ETZ", "price": "kalk. Preis incl. ETZ", "offerPrice": "Angebotspreis pro Stück"}, "missing": "Noch eingeben: {fields}", "invalid": "Bitte prüfen (darf nicht negativ oder 0 sein): {fields}", "warnings": "Ohne Pulverkosten – fehlt: {fields}"},
  materials: { steel: "Stahl", stainless: "Edelstahl", aluminium: "Aluminium", castIron: "Guss", zinc: "Zinkdruckguss" },
  units: { pcs: "Stk." },
  common: { yes: "Ja", no: "Nein", close: "Schließen", done: "Fertig", language: "Sprache" },
  process: { label: "Verfahren", ktl: "KTL", pulver: "Pulver", schaeumen: "Schäumen" },
  top: {
    chooseCustomer: "Kunde wählen",
    offerNo: "Angebot {no}",
    noOfferNo: "ohne Angebotsnummer",
    new: "Neu",
    newTitle: "Neues leeres Angebot",
    settings: "Kalkulationsvorgaben",
    preview: "Angebot ansehen",
    save_idle: "Speichern",
    save_saving: "Speichert …",
    save_saved: "Gespeichert",
    save_error: "Nicht gespeichert",
    saveError: "Die Datenbank war nicht erreichbar – bitte erneut speichern.",
  },
  confirm: {
    newOffer: "Neues leeres Angebot beginnen? Das aktuelle wird verworfen.",
    removePart: "Dieses Teil aus dem Angebot löschen?",
    resetSettings: "Alle Vorgaben auf die Excel-Werte zurücksetzen?",
  },
  parts: {
    title: "Teile",
    add: "Teil hinzufügen",
    partN: "Teil {n}",
    noNumber: "ohne Nummer",
    pcs: "{n} Stk.",
    missing: "fehlt noch",
    typed: "Angebotspreis",
    calculated: "kalkuliert",
    copy: "Kopieren",
    copyOf: "{name} kopieren",
    delete: "Löschen",
    deleteOf: "{name} löschen",
    total: "Angebotswert (Preis × Menge)",
    copySuffix: "(Kopie)",
  },
  work: {
    partOf: "{process} · Teil {n} von {count}",
    newPart: "Neues Teil",
    piecesPerCarrier: "Stück / Warenträger",
    piecesPerHour: "Stück / Stunde",
    carriersPerYear: "Warenträger / Jahr",
    surface: "Oberfläche",
    hooksPerMetre: "Haken / Meter",
    partsPerHour: "Teile / Stunde",
    runtime: "Laufzeit Menge",
    powderPerPart: "Pulver / Teil",
  },
  box: {
    part: "Teil",
    surface: "Oberfläche",
    process: "Verfahren",
    staff: "Personal & Takt",
    remark: "Bemerkung",
    oneTime: "Einmalkosten",
    quantityPowder: "Menge & Pulver",
    hangingChain: "Aufhängung & Kette",
    staffPulver: "Personal",
    masking: "Abdecken",
  },
  ktl: {
    name: "Teilebezeichnung",
    drawingNo: "Zeichnungsnummer",
    paintSpec: "Lackiervorschrift",
    quantity: "Jahresstückzahl / Losgröße",
    layer: "Schichtdicke",
    surface: "Oberfläche",
    surfaceHint: "= {m2} m² (C3)",
    weight: "Stückgewicht",
    thickness: "Materialstärke",
    fromWeight: "Aus Gewicht berechnet",
    takeOver: "In B3 übernehmen",
    beizen: "Beizen",
    guss: "Gußteil",
    masking: "Maskierungen",
    paint: "KTL-Lack",
    loadMinutes: "Zeit Auf/Abspannen pro WT",
    workers: "Mitarbeiter Auf/Abspannen",
    wage: "Kosten Mitarbeiter / Stunde",
    minutesPerCarrier: "Zeit pro Warenträger",
    testCost: "Preis Korrosionsschutztests",
    rackCost: "Gestellbaukosten",
    noStaff: "Ohne Mitarbeiter und Zeit zeigt die Excel keinen Preis („keine Personalkosten“).",
    remarkHint: "Interne Notiz zu diesem Teil – erscheint nicht im Angebot",
  },
  pulver: {
    name: "Teilename",
    customer: "Kunde",
    requestDate: "Anfragedatum",
    description: "Artikelbezeichnung",
    customerNo: "Artikelnummer Kunde",
    osteksNo: "Artikelnummer Osteks",
    material: "Material",
    weight: "Gewicht",
    thickness: "Materialstärke",
    surface: "Oberfläche [cm²]",
    surfaceFromWeight: "Oberfläche [mm²] (beide Seiten)",
    bothSides: "berechnet aus Gewicht und Materialstärke",
    surfaceUsed: "für die Pulvermenge – B20",
    quantity: "Anfragemenge",
    powderPrice: "Pulver-Preis pro kg",
    layer: "Mittlere Schichtdicke",
    length: "Teilelänge",
    perHook: "Teile pro Haken",
    hooksPerMetre: "Haken pro Meter",
    hooksAuto: "berechnet: 1 ÷ (Teilelänge + Zwischenraum)",
    speed: "Kettengeschwindigkeit",
    gap: "Zwischenraum",
    workers: "Anzahl Mitarbeiter",
    wage: "Stundenlohn Mitarbeiter",
    priceWithoutMaterial: "Preis ohne Material",
    plugs: "Anzahl Abstöpselungen",
    tapes: "Anzahl Abklebungen",
  },
  result: {
    offerPrice: "Angebotspreis / Stk.",
    emptyHint: "leer = kalkulierter Preis gerundet",
    view: "Ansicht",
    noStaffCosts: "keine Personalkosten",
    share: "Anteil",
    amount: "Betrag",
    costPerPart: "Kosten pro Teil",
    ktl: {
      price: "Summe / Teil nach Maschinenstunde",
      oldPrice: "nach alter Kalkulation",
      tabMachine: "Maschinenstundensatz",
      tabInfo: "Kennzahlen",
      machineRate: "Maschinenstundensatz",
      carriersPerHour: "Anzahl Warenträger pro Stunde",
      machinePerCarrier: "Maschinenstundensatz pro Warenträger",
      staffPerCarrier: "Personalkosten je Warenträger",
      paint: "KTL-Lack ({paint})",
      pickling: "Beizen ({rate} €/m²)",
      pretreat: "Vorbehandlung ({rate} €/m²)",
      material: "Materialeinsatz",
      masking: "Maskierung",
      casting: "Gußzuschlag",
      machine: "Fertigungskosten (Maschinenstundensatz)",
      staff: "Personalkosten",
      overhead: "Gemeinkosten ({pct})",
      sum: "Summe",
      etz: "zzgl. ETZ ({pct})",
      oldBase: "Preis pro Teil (115 € / Stück pro WT + 0,08 €)",
      oldPickling: "Beizen (Formel nutzt H2 = 0,395 €/m²)",
      oldMasking: "Maskierung pro Teil",
      oldCasting: "Gußzuschlag",
      oldSum: "Summe",
      oldEtz: "zzgl. ETZ (Januar 2024)",
      oldPriceLong: "Summe / Teil nach alter Kalkulation",
      weightPerCarrier: "Gewicht pro Warenträger",
      revenuePerCarrier: "Umsatz pro Warenträger",
      revenuePerM2: "Umsatz pro m²",
      revenuePerYear: "Umsatz pro Jahr (Preis × Menge)",
      area: "Oberfläche",
      partsPerCarrier: "Stück pro Warenträger",
      minutesPerCarrier: "Zeit pro Warenträger",
      utilisation: "Nutzungsgrad",
      piecesPerHour: "Stück pro Stunde",
      carriersPerDay: "Anzahl Warenträger pro Tag",
      carriersPerYear: "Anzahl Warenträger pro Jahr",
      ratePerCarrierTable: "Stundensatz pro Warenträger (Tabelle, 6 WT/h)",
      variablePerCarrier: "variable Kosten pro Warenträger",
      sumPerCarrier: "Summe pro Warenträger",
      secLine: "Teil & Anlage",
      secRevenue: "Warenträger & Umsatz",
      secTable: "Kostentabelle pro Warenträger",
      secTableNote: "zur Info – nicht im Preis",
    },
    pulver: {
      secDefaults: "Kalkulationsvorgaben (nicht ändern!)",
      secInfo: "Zur Info",
      secMachine: "Maschine & Personal",
      tabLine: "Anlage & Info",
      tabMaterial: "Sollumsatz & Material",
      secTarget: "Sollumsatz",
      secPowder: "Pulver",
      usefulHours: "Nutzzeit pro Schicht",
      perShift: "Umsatz pro Schicht",
      perHour: "Umsatz pro Stunde",
      partsPerHour: "Teile pro Stunde",
      runtime: "Laufzeit Anfragemenge",
      runtimeValue: "{min} min = {h} h",
      revenueForQty: "Umsatz Anfragemenge",
      machineRate: "Maschinenstundensatz",
      machinePerPart: "MSS / Stck.",
      workers: "Anzahl Mitarbeiter",
      wage: "Stundenlohn Mitarbeiter",
      wagePerPart: "Lohnkosten pro Stck.",
      target: "Sollumsatz ohne Material",
      materialShareNormal: "Normalmaterialeinsatz in %",
      speed: "Kettengeschwindigkeit",
      powderDensity: "spez. Gewicht",
      powderPerPart: "Menge pro Teil",
      materialPerPart: "Materialkosten pro Teil",
      materialPerShift: "Materialmenge pro Schicht",
    },
  },
  settings: {
    // every calculated value with its formula (tabs "KTL / Powder · Calculation")
    formulas: {
      "tabKtl": "KTL · Berechnung",
      "tabPulver": "Pulver · Berechnung",
      "intro": "So rechnet die Kalkulation – Schritt für Schritt wie in der Excel. Die Zahlen in den Formeln sind die aktuellen Vorgaben; ändern Sie eine Vorgabe, ändert sich die Formel mit.",
      "notInPrice": "zur Info – nicht im Preis",
      "ktl": {
        "sections": {
          "machine": "Maschinenstundensatz (Kostentabelle)",
          "part": "Grundwerte pro Teil",
          "price": "Preis pro Teil – nach Maschinenstundensatz",
          "figures": "Kennzahlen",
          "old": "Alte Kalkulation (Spalte B)",
          "info": "Kostentabelle pro Warenträger"
        },
        "rows": {
          "T9": [
            "Stunden pro Jahr, einschichtig",
            "{hoursPerShift} h pro Schicht × {workingDays} Arbeitstage × {availability} Verfügbarkeit = {hoursOne} h"
          ],
          "L21": [
            "Jahresstunden KTL",
            "{hoursOne} h × {shifts} Schichten = {hoursKtl} h"
          ],
          "L20": [
            "Fixkosten KTL pro Jahr",
            "Summe aller Fixkosten × ihr KTL-Anteil = {fixedKtl}"
          ],
          "L22": [
            "Maschinenstundensatz",
            "Fixkosten KTL ÷ Jahresstunden = {fixedKtl} ÷ {hoursKtl} h = {rate} pro Stunde"
          ],
          "C3": [
            "Oberfläche in m²",
            "Oberfläche in mm² ÷ 1.000.000"
          ],
          "B7": [
            "Stück pro Warenträger",
            "abgerundet ({carrierM2} m² × 1.000.000 ÷ Oberfläche in mm²) – höchstens die Jahresstückzahl"
          ],
          "B16": [
            "Oberfläche aus Gewicht",
            "Gewicht in g × 2000 ÷ (Materialstärke in mm × {density} g/cm³) – nur als Hilfe zum Übernehmen"
          ],
          "F6": [
            "Stück pro Stunde",
            "Stück pro Warenträger × 60 × {utilisation} Nutzungsgrad ÷ {minutes} min"
          ],
          "F9": [
            "Warenträger pro Stunde",
            "60 ÷ {minutes} min = {carriersPerHour}"
          ],
          "F10": [
            "Maschinenstundensatz pro Warenträger",
            "{rate} ÷ {carriersPerHour} Warenträger = {ratePerCarrier}"
          ],
          "F11": [
            "Personalkosten je Warenträger",
            "Zeit Auf/Abspannen in min × Mitarbeiter × {wage} pro Stunde ÷ 60"
          ],
          "F21": [
            "KTL-Lack",
            "D-KTL: {paintDktl} × m² · N-KTL: {paintNktl} × m²"
          ],
          "F22": [
            "Vorbehandlung",
            "normal: {pretreatNormal} × m² · Beizen: {pretreatBeizen} × m²"
          ],
          "F23": [
            "Materialeinsatz",
            "KTL-Lack + Vorbehandlung"
          ],
          "F24": [
            "Maskierung",
            "{masking} × Anzahl Maskierungen"
          ],
          "F25": [
            "Gußzuschlag",
            "nur bei Gußteil: (Preis pro Teil B25 + Beizen B26) × {casting}"
          ],
          "F26": [
            "Fertigungskosten",
            "Maschinenstundensatz pro Warenträger ÷ Stück pro Warenträger"
          ],
          "F27": [
            "Personalkosten",
            "Personalkosten je Warenträger ÷ Stück pro Warenträger"
          ],
          "F28": [
            "Gemeinkosten",
            "(Materialeinsatz + Fertigungskosten + Personalkosten) × {overhead}"
          ],
          "F29": [
            "Summe",
            "Materialeinsatz + Maskierung + Gußzuschlag + Fertigung + Personal + Gemeinkosten"
          ],
          "F30": [
            "zzgl. ETZ",
            "Summe × {etz}"
          ],
          "F32": [
            "Kalkulierter Preis pro Teil",
            "Summe + ETZ – nur wenn Personalkosten > 0 (sonst „keine Personalkosten“)"
          ],
          "B20": [
            "Gewicht pro Warenträger",
            "Stück pro Warenträger × Gewicht in g ÷ 1000 (kg)"
          ],
          "B21": [
            "Umsatz pro Warenträger",
            "Stück pro Warenträger × Summe der alten Kalkulation (B29)"
          ],
          "B22": [
            "Umsatz pro m²",
            "Summe der alten Kalkulation (B29) × 1.000.000 ÷ Oberfläche in mm²"
          ],
          "B23": [
            "Umsatz pro Jahr",
            "Angebotspreis (leer: kalkulierter Preis, gerundet) × Jahresstückzahl"
          ],
          "F33": [
            "Warenträger pro Tag",
            "Jahresstückzahl ÷ ({workingDaysYear} Tage × Stück pro Warenträger)"
          ],
          "F34": [
            "Warenträger pro Jahr",
            "Jahresstückzahl ÷ Stück pro Warenträger"
          ],
          "B25": [
            "Preis pro Teil",
            "{basePerCarrier} ÷ Stück pro Warenträger + {basePerPart}"
          ],
          "B26": [
            "Beizen",
            "nur bei Beizen: {paintDktl} × m² (die Excel nutzt hier den D-KTL-Lackpreis H2)"
          ],
          "B27": [
            "Maskierung pro Teil",
            "{masking} × Anzahl Maskierungen"
          ],
          "B28": [
            "Gußzuschlag",
            "nur bei Gußteil: (B25 + B26) × {casting}"
          ],
          "B29": [
            "Summe",
            "B25 + B26 + B27 + B28"
          ],
          "B32": [
            "Summe/Teil nach alter Kalkulation",
            "Summe × (1 + {etz} ETZ) – nur wenn Personalkosten > 0"
          ],
          "L25": [
            "Stundensatz pro Warenträger (Tabelle)",
            "{rate} ÷ {carriersTable} Warenträger pro Stunde = {ratePerUnit}"
          ],
          "L26": [
            "Variable Kosten pro Warenträger",
            "je variable Kostenart: Betrag × KTL-Anteil ÷ {hoursKtl} h ÷ {carriersTable} – zusammen {variablePerUnit}"
          ],
          "L27": [
            "Summe pro Warenträger",
            "{ratePerUnit} + {variablePerUnit} = {sumPerUnit}"
          ]
        }
      },
      "pulver": {
        "sections": {
          "target": "Sollumsatz (Kalkulationsvorgaben)",
          "surface": "Oberfläche",
          "hanging": "Aufhängung & Durchsatz",
          "price": "Preis pro Teil",
          "info": "Zur Info"
        },
        "rows": {
          "H23": [
            "Sollumsatz ohne Material pro Stunde",
            "{targetBase} × {targetFactor} = {target}"
          ],
          "H7": [
            "Umsatz pro Schicht",
            "{usefulHours} h Nutzzeit × {target} = {perShift}"
          ],
          "B17": [
            "Oberfläche aus Gewicht (mm², beide Seiten)",
            "Gewicht in g × 2000 ÷ (Materialstärke in mm × Dichte des Materials, Stahl {density} g/cm³)"
          ],
          "D20": [
            "Oberfläche in mm²",
            "Oberfläche in cm² × 100"
          ],
          "B25": [
            "Haken pro Meter",
            "1 ÷ (Teilelänge + {gap} m Zwischenraum) – gerechnet wird mit allen Stellen, angezeigt werden zwei (wie in der Excel)"
          ],
          "H10": [
            "Teile pro Stunde",
            "{speed} m/min × 60 × Haken pro Meter × Teile pro Haken"
          ],
          "H11": [
            "Laufzeit Anfragemenge",
            "Anfragemenge × 60 ÷ Teile pro Stunde (in Minuten)"
          ],
          "B29": [
            "Preis ohne Material",
            "{target} ÷ Teile pro Stunde"
          ],
          "B33": [
            "Preis ohne Material inkl. Zusatz",
            "B29 + {plug} × Abstöpselungen + {tape} × Abklebungen"
          ],
          "H27": [
            "Pulvermenge pro Teil",
            "Oberfläche in cm² × Schichtdicke ({layer} µm) × {powderDensity} g/cm³ ÷ ({transfer} × 10.000) – in g"
          ],
          "B34": [
            "Materialeinsatz",
            "Pulvermenge in g × Pulver-Preis pro kg ÷ 1000"
          ],
          "B35": [
            "Preis mit Material",
            "B33 + Materialeinsatz"
          ],
          "B37": [
            "Kalkulierter Preis inkl. ETZ",
            "Preis mit Material × (1 + {etz} ETZ)"
          ],
          "D35": [
            "Materialanteil",
            "Materialeinsatz ÷ Preis mit Material (üblich: {materialShare})"
          ],
          "H12": [
            "Umsatz Anfragemenge",
            "Anfragemenge × Preis ohne Material (B29)"
          ],
          "H17": [
            "Maschinenstundensatz pro Stück",
            "{machineRate} pro Stunde ÷ Teile pro Stunde"
          ],
          "H20": [
            "Lohnkosten pro Stück",
            "{workers} Mitarbeiter × {wage} pro Stunde ÷ Teile pro Stunde"
          ],
          "H30": [
            "Pulvermenge pro Schicht",
            "Pulvermenge pro Teil × Teile pro Stunde × {usefulHours} h ÷ 1000 (kg)"
          ]
        }
      }
    },
    title: "Kalkulationsvorgaben",
    subtitle: "Feste Werte der Excel-Kalkulationen – einmal pflegen, gilt für jedes Angebot.",
    keyRate: "Maschinenstundensatz KTL",
    area: "Bereich",
    tabCosts: "KTL · Kosten & Maschinenstundensatz",
    tabVariable: "KTL · Variable Kosten",
    tabParams: "KTL · Teilekalkulation",
    tabPulver: "Pulver · Vorgaben",
    reset: "{process} auf Excel-Werte zurücksetzen",
    hours: "Ermittlung Stunden p.a. (S5:T14)",
    hoursPerShift: "pro Schicht (T6)",
    workingDays: "Arbeitstage (T7)",
    availability: "Verfügbarkeit (T8)",
    onePerYear: "einschichtig p.a. (T9)",
    shiftsKtl: "Schichten KTL (L21)",
    shiftsPulver: "Schichten Pulver (N21)",
    shiftsSchaeumen: "Schichten Schäumen (P21)",
    carriersPerHour: "Warenträger pro Stunde (T13)",
    chainPerHour: "Meter Kette pro Stunde (T14)",
    col: {
      name: "Bezeichnung (I)",
      amount: "Betrag (J)",
      ktlPct: "KTL % (M)",
      pulverPct: "Pulver % (O)",
      schaeumenPct: "Schäumen % (Q)",
      ktlEur: "KTL € (L)",
      pulverEur: "Pulver € (N)",
      schaeumenEur: "Schäumen € (P)",
      varName: "Bezeichnung (V)",
      varAmount: "Betrag (W)",
      varKtl: "KTL % (Z)",
      varPulver: "Pulver % (AB)",
      varSchaeumen: "Schäumen % (AD)",
      ktlHour: "KTL / Stunde (Y12)",
      ktlPerCarrier: "KTL / WT (Y18)",
      pulverPerMetre: "Pulver / Meter (AA18)",
      schaeumen: "Schäumen (AC18)",
    },
    row: {
      sum: "Summe (Zeile 20)",
      hours: "Jahresstunden (Zeile 21)",
      rate: "Maschinenstundensatz (Zeile 22)",
      ratePerUnit: "Stundensatz pro Warenträger / Meter Kette (Zeile 25)",
      variablePerUnit: "variable Kosten pro WT / Meter (Zeile 26)",
      sumPerUnit: "Summe pro WT / Meter (Zeile 27)",
      variableSum: "Summe pro WT / Meter (Zeile 22)",
    },
    variableNote: "Diese Werte stehen in der Excel in Y22 / L26, fließen aber nicht in den Teilepreis (F21–F32) ein – zur Klärung im Meeting.",
    amountOf: "{name} Betrag",
    shareOf: "{name} {line}",
    costs: {
      f0: "Entlackungskosten",
      f1: "Rückstellung Weihnachtsgeld",
      f2: "Gehälter",
      f3: "Gas",
      f4: "Strom",
      f5: "Reparaturen/Instandhaltung",
      f6: "Stapler Reparaturen",
      f7: "Entsorgungskosten Remondis",
      f8: "ext. Reklamationskosten",
      f9: "Fremdleistungen Speditionen",
      f10: "Factoringgebühren",
      f11: "Sonstige Kosten",
      f12: "AfA",
      f13: "Zinsen (einschl. Factoringzinsen 7318)",
      v0: "Materialeinsatz",
      v1: "Löhne",
      v2: "Fremdleistung Oriones, Grace",
      v3: "Lebenshilfe",
    },
    param: {
      carrierSurfaceM2: "Oberfläche je Warenträger",
      minutesPerCarrier: "Zeit pro Warenträger",
      utilisation: "Nutzungsgrad",
      wagePerHour: "Kosten Mitarbeiter / Stunde",
      overhead: "Gemeinkosten",
      etz: "zzgl. ETZ",
      paintDktl: "D-KTL Lack",
      paintNktlFormula: "N-KTL Lack (Formel F21)",
      paintNktlTable: "N-KTL (Tabelle oben)",
      pretreatNormal: "Vorbehandlung normal",
      pretreatBeizen: "Beizen (neue Kalkulation)",
      maskingPerPoint: "Maskierung pro Stück",
      castingSurcharge: "Gußzuschlag",
      basePerCarrier: "Alt: Betrag pro Warenträger",
      basePerPart: "Alt: Zuschlag pro Teil",
      densitySteel: "spez. Gewicht Stahl",
      usefulHoursPerShift: "Nutzzeit pro Schicht",
      targetBase: "Sollumsatz (Basis)",
      targetFactor: "Faktor ohne Material",
      materialShare: "Normalmaterialeinsatz",
      machineRate: "Maschinenstundensatz",
      workers: "Anzahl Mitarbeiter",
      pulverWage: "Stundenlohn Mitarbeiter",
      chainSpeed: "Kettengeschwindigkeit",
      gapMetres: "Zwischenraum",
      layerUm: "mittlere Schichtdicke",
      powderDensity: "spez. Gewicht Pulver",
      transferEfficiency: "Auftragswirkungsgrad",
      coatingHeight: "Beschichtungshöhe",
      pricePerPlug: "Preis pro Abstöpselung",
      pricePerTape: "Preis pro Abkleben",
    },
    note: {
      alsoB26: "B26 (Beizen alt) nutzt ebenfalls H2",
      h3Shows: "H3 zeigt 0,19",
      notCalculated: "wird nicht gerechnet",
      textSays010: "Text sagt 0,10",
      displayOnly: "nur Anzeige",
      infoOnly: "nur zur Info",
      inNoFormula: "in keiner Formel",
    },
  },
  offer: {
    title: "Kunde & Angebot",
    subtitleKtl: "KTL-Angebot – Empfänger, Nummern und Texte des Anschreibens.",
    subtitlePulver: "Pulver-Angebot – Empfänger, Nummern und Texte des Anschreibens.",
    textsNote: "Die Texte gelten für das Anschreiben auf {language}.",
    recipient: "Empfänger",
    company: "Firma",
    person: "Ansprechpartner (Herr / Frau …)",
    personPlaceholder: "Herr Michel",
    address: "Adresse",
    addressPlaceholder: "Straße und Nr.\nPLZ Ort",
    offerSection: "Angebot",
    project: "Projekt",
    offerNo: "Angebot Nr.",
    requestDate: "Anfrage vom",
    offerDate: "Angebotsdatum",
    calculatedBy: "kalkuliert von",
    spec: "Spezifikation",
    notes: "Hinweise im Anschreiben",
    terms: "Konditionen",
    label: "Bezeichnung",
    noteN: "Hinweis {n}",
    resetTexts: "Standardtexte wiederherstellen",
    languageName: "Deutsch",
  },
  // what went wrong in the background (Work Place) and the crash guard
  notice: {
    drawingNotStored: "Die Zeichnung wurde gelesen und eingetragen, konnte aber nicht gespeichert werden (Datenbank nicht erreichbar). Mit „Speichern“ wird das Angebot trotzdem gespeichert.",
    drawingLimit: "Ein Angebot kann höchstens 4 Zeichnungen speichern – diese wurde eingetragen, aber nicht als Zeichnung gespeichert.",
    offerNotFound: "Dieses Angebot gibt es nicht mehr (in „Alle Angebote“ gelöscht?). Das zuletzt bearbeitete Angebot bleibt geöffnet.",
    saveFailed: "Das Angebot wurde nicht gespeichert – die Datenbank war nicht erreichbar. Ihre Eingaben bleiben erhalten; bitte gleich erneut speichern.",
    offerNotLoaded: "Das Angebot konnte nicht geladen werden (Datenbank nicht erreichbar). Bitte später erneut öffnen.",
    close: "Hinweis schließen",
  },
  crash: {
    title: "Das Angebot konnte nicht angezeigt werden",
    text: "Beim Anzeigen ist ein Fehler aufgetreten. Neu laden behebt das meistens; sonst ein neues Angebot beginnen – gespeicherte Angebote und Zeichnungen bleiben in „Alle Angebote“.",
    reload: "Neu laden",
    reset: "Neues Angebot beginnen",
  },
  // Powder letter: the texts of "Angebot 32484-00014", shown in the layout of
  // Document Preview (KTL keeps Document Preview's own texts). withSpecNote is
  // the line Document Preview shows for "With specification".
  letter: {
    pulver: {
      spec: [
        ["Vorbehandlung", "Entfetten, Eisenphosphatieren, VE-Spülen"],
        ["Beschichtung", "Pulverbeschichtung Verkehrsweiß glatt, matt RAL9016, FreiLacke"],
        ["Schichtdicke", "60 – 120 µm"],
      ],
      paragraphs: [
        "Die Machbarkeit bzw. erzielbare Qualität der Beschichtung können wir erst nach Erhalt von ersten Musterteilen und nach Durchführung von Lackierversuchen festlegen.",
        "Nach Erhalt einer Verpackungsvorschrift und nach Prüfung des Verpackungsaufwandes behalten wir uns eine Angebotsprüfung vor.",
        "Geometrie- und prozessbedingt kann es an dem angebotenen Teil zur von uns nicht beeinflussbaren Lackanhäufungen und Lackläufern kommen. Ein Nacharbeiten der Merkmale ist nicht im Angebot enthalten.",
        "Anteilige Einmalkosten für einen Erstmusterprüfbericht nach VDA bzw. PPAP: 500,- €. Bei Erhalt des Serienauftrags keine. Sonderprüfungen werden nach Aufwand berechnet.",
      ],
      withSpecNote: "Der Angebotspreis versteht sich inkl. Abdeckungen jedoch ohne Überprüfung von Gewindegängigkeiten/Passgenauigkeiten und Funktionsprüfungen. Für eventuell notwendige Prüfungen fallen zusätzliche Kosten an.",
      terms: [
        ["Anlieferung", "Frei Haus Elterlein, Am Gansberg 2"],
        ["Rücklieferung", "Ab Werk Elterlein, Am Gansberg 2"],
        ["Verpackung", "lagenweise in kostenlos beigestellten sauberen kundeneigenen Behältern, Behälter stapelbar."],
        ["Lieferzeit", "ca. 10 – 15 Arbeitstage nach Wareneingang und Klärung aller offenen Fragen bzw. nach besonderer Vereinbarung"],
        ["Zahlung", "30 Tage netto"],
        ["Angebotsgültigkeit", "freibleibend"],
      ],
    },
  },
};

export default de;
