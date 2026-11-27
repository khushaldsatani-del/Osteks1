// English - a natural business translation, not word for word. Company
// names, addresses and the Excel cell references stay as they are.
const en = {
  app: {
    title: "Create offer",
    subtitle: "KTL and powder offers with the Excel calculation",
    docTitle: "Create offer · Preview",
  },
  shell: {"openMenu": "Open menu", "closeMenu": "Close menu", "menu": "Main menu", "workPlace": "Work Place", "allDocuments": "All Documents", "testReport": "Test Report", "eightD": "8D Report", "shiftPlanning": "Shift Planning", "productionView": "Production View", "normLibrary": "Norm Library"},
  form: {"moreValues": "More values", "changed": "{n} changed", "useFromWeight": "Use value from weight: {value}", "useFromWeightPulver": "Use value from weight: {cm2} cm² ({mm2} mm²)", "notInPrice": "for information – not in the price"},
  price: {"calculated": "Calculated price / pc", "excel": {"base": "Price per part", "pickling": "Pickling (25ct/m²)", "masking": "Masking per part [0.10ct/part]", "casting": "Casting surcharge", "sum": "Total", "etz": "plus ETZ (January 2024)", "total": "Total/part by old calculation", "offerPrice": "Offer price"}, "details": "Calculation details", "pulverExcel": {"withoutMaterial": "Price without material", "material": "Material", "withMaterial": "Price with material", "etz": "plus ETZ", "price": "Calc. price incl. ETZ", "offerPrice": "Offer price per piece"}, "missing": "Still to enter: {fields}", "invalid": "Please check (must not be negative or 0): {fields}", "warnings": "No powder cost – missing: {fields}"},
  materials: { steel: "Steel", stainless: "Stainless steel", aluminium: "Aluminium", castIron: "Cast iron", zinc: "Zinc die-cast" },
  units: { pcs: "pcs" },
  common: { yes: "Yes", no: "No", close: "Close", done: "Done", language: "Language" },
  process: { label: "Process", ktl: "KTL", pulver: "Powder", schaeumen: "Foaming" },
  top: {
    chooseCustomer: "Choose customer",
    offerNo: "Offer {no}",
    noOfferNo: "no offer number",
    new: "New",
    newTitle: "New empty offer",
    settings: "Calculation settings",
    preview: "View offer",
    save_idle: "Save",
    save_saving: "Saving …",
    save_saved: "Saved",
    save_error: "Not saved",
    saveError: "The database could not be reached – please save again.",
  },
  confirm: {
    newOffer: "Start a new empty offer? The current one will be discarded.",
    removePart: "Remove this part from the offer?",
    resetSettings: "Reset all settings to the Excel values?",
  },
  parts: {
    title: "Parts",
    add: "Add part",
    partN: "Part {n}",
    noNumber: "no number",
    pcs: "{n} pcs",
    missing: "missing",
    typed: "offer price",
    calculated: "calculated",
    copy: "Copy",
    copyOf: "Copy {name}",
    delete: "Delete",
    deleteOf: "Delete {name}",
    total: "Offer value (price × quantity)",
    copySuffix: "(copy)",
  },
  work: {
    partOf: "{process} · Part {n} of {count}",
    newPart: "New part",
    piecesPerCarrier: "Pieces / carrier",
    piecesPerHour: "Pieces / hour",
    carriersPerYear: "Carriers / year",
    surface: "Surface",
    hooksPerMetre: "Hooks / metre",
    partsPerHour: "Parts / hour",
    runtime: "Run time qty",
    powderPerPart: "Powder / part",
  },
  box: {
    part: "Part",
    surface: "Surface",
    process: "Process",
    staff: "Staff & cycle",
    remark: "Remark",
    oneTime: "One-time costs",
    quantityPowder: "Quantity & powder",
    hangingChain: "Hanging & chain",
    staffPulver: "Staff",
    masking: "Masking",
  },
  ktl: {
    name: "Part name",
    drawingNo: "Drawing number",
    paintSpec: "Coating specification",
    quantity: "Annual quantity / lot size",
    layer: "Layer thickness",
    surface: "Surface",
    surfaceHint: "= {m2} m² (C3)",
    weight: "Part weight",
    thickness: "Material thickness",
    fromWeight: "Calculated from weight",
    takeOver: "Use in B3",
    beizen: "Pickling",
    guss: "Cast part",
    masking: "Masking points",
    paint: "KTL paint",
    loadMinutes: "Load / unload time per carrier",
    workers: "Workers loading / unloading",
    wage: "Staff cost / hour",
    minutesPerCarrier: "Time per carrier",
    testCost: "Corrosion protection tests",
    rackCost: "Rack construction costs",
    noStaff: "Without workers and time the Excel shows no price (\"keine Personalkosten\").",
    remarkHint: "Internal note for this part – not printed in the offer",
  },
  pulver: {
    name: "Part name",
    customer: "Customer",
    requestDate: "Enquiry date",
    description: "Item description",
    customerNo: "Customer item number",
    osteksNo: "Osteks item number",
    material: "Material",
    weight: "Weight",
    thickness: "Material thickness",
    surface: "Surface [cm²]",
    surfaceFromWeight: "Surface [mm²] (both sides)",
    bothSides: "calculated from weight and thickness",
    surfaceUsed: "used for the powder – B20",
    quantity: "Quantity",
    powderPrice: "Powder price per kg",
    layer: "Average layer thickness",
    length: "Part length",
    perHook: "Parts per hook",
    hooksPerMetre: "Hooks per metre",
    hooksAuto: "calculated: 1 ÷ (part length + gap)",
    speed: "Chain speed",
    gap: "Gap",
    workers: "Number of employees",
    wage: "Hourly wage per employee",
    priceWithoutMaterial: "Price without material",
    plugs: "Number of plugs",
    tapes: "Number of tapings",
  },
  result: {
    offerPrice: "Offer price / pc",
    emptyHint: "empty = calculated price, rounded",
    view: "View",
    noStaffCosts: "no staff costs",
    share: "Share",
    amount: "Amount",
    costPerPart: "Cost per part",
    ktl: {
      price: "Total / part by machine hour",
      oldPrice: "by old calculation",
      tabMachine: "Machine-hour rate",
      tabInfo: "Key figures",
      machineRate: "Machine-hour rate",
      carriersPerHour: "Carriers per hour",
      machinePerCarrier: "Machine-hour rate per carrier",
      staffPerCarrier: "Staff cost per carrier",
      paint: "KTL paint ({paint})",
      pickling: "Pickling ({rate} €/m²)",
      pretreat: "Pre-treatment ({rate} €/m²)",
      material: "Material",
      masking: "Masking",
      casting: "Casting surcharge",
      machine: "Production cost (machine-hour rate)",
      staff: "Staff cost",
      overhead: "Overhead ({pct})",
      sum: "Total",
      etz: "plus ETZ ({pct})",
      oldBase: "Price per part (€115 / pieces per carrier + €0.08)",
      oldPickling: "Pickling (formula uses H2 = €0.395/m²)",
      oldMasking: "Masking per part",
      oldCasting: "Casting surcharge",
      oldSum: "Total",
      oldEtz: "plus ETZ (January 2024)",
      oldPriceLong: "Total / part by old calculation",
      weightPerCarrier: "Weight per carrier",
      revenuePerCarrier: "Revenue per carrier",
      revenuePerM2: "Revenue per m²",
      revenuePerYear: "Revenue per year (price × qty)",
      area: "Surface",
      partsPerCarrier: "Pieces per carrier",
      minutesPerCarrier: "Time per carrier",
      utilisation: "Utilisation",
      piecesPerHour: "Pieces per hour",
      carriersPerDay: "Carriers per day",
      carriersPerYear: "Carriers per year",
      ratePerCarrierTable: "Hourly rate per carrier (table, 6 carriers/h)",
      variablePerCarrier: "Variable costs per carrier",
      sumPerCarrier: "Total per carrier",
      secLine: "Part & line",
      secRevenue: "Carrier & revenue",
      secTable: "Cost table per carrier",
      secTableNote: "for information – not in the price",
    },
    pulver: {
      secDefaults: "Calculation defaults (do not change!)",
      secInfo: "For information",
      secMachine: "Machine & staff",
      tabLine: "Line & information",
      tabMaterial: "Target revenue & material",
      secTarget: "Target revenue",
      secPowder: "Powder",
      usefulHours: "Productive time per shift",
      perShift: "Revenue per shift",
      perHour: "Revenue per hour",
      partsPerHour: "Parts per hour",
      runtime: "Run time for requested qty",
      runtimeValue: "{min} min = {h} h",
      revenueForQty: "Revenue for requested qty",
      machineRate: "Machine-hour rate",
      machinePerPart: "Machine cost / pc",
      workers: "Number of employees",
      wage: "Hourly wage per employee",
      wagePerPart: "Wage cost / pc",
      target: "Target revenue without material",
      materialShareNormal: "Normal material share",
      speed: "Chain speed",
      powderDensity: "Powder density",
      powderPerPart: "Quantity per part",
      materialPerPart: "Material cost per part",
      materialPerShift: "Material quantity per shift",
    },
  },
  settings: {
    // every calculated value with its formula (tabs "KTL / Powder · Calculation")
    formulas: {
      "tabKtl": "KTL · Calculation",
      "tabPulver": "Powder · Calculation",
      "intro": "How the calculation works – step by step, as in the Excel. The numbers in the formulas are the current settings; change a setting and the formula changes with it.",
      "notInPrice": "for information – not in the price",
      "ktl": {
        "sections": {
          "machine": "Machine-hour rate (cost table)",
          "part": "Basic values per part",
          "price": "Price per part – by machine-hour rate",
          "figures": "Key figures",
          "old": "Old calculation (column B)",
          "info": "Cost table per carrier"
        },
        "rows": {
          "T9": [
            "Hours per year, one shift",
            "{hoursPerShift} h per shift × {workingDays} working days × {availability} availability = {hoursOne} h"
          ],
          "L21": [
            "KTL hours per year",
            "{hoursOne} h × {shifts} shifts = {hoursKtl} h"
          ],
          "L20": [
            "KTL fixed costs per year",
            "all fixed costs × their KTL share = {fixedKtl}"
          ],
          "L22": [
            "Machine-hour rate",
            "KTL fixed costs ÷ hours per year = {fixedKtl} ÷ {hoursKtl} h = {rate} per hour"
          ],
          "C3": [
            "Surface in m²",
            "surface in mm² ÷ 1,000,000"
          ],
          "B7": [
            "Pieces per carrier",
            "rounded down ({carrierM2} m² × 1,000,000 ÷ surface in mm²) – at most the annual quantity"
          ],
          "B16": [
            "Surface from weight",
            "weight in g × 2000 ÷ (material thickness in mm × {density} g/cm³) – only a helper to take over"
          ],
          "F6": [
            "Pieces per hour",
            "pieces per carrier × 60 × {utilisation} utilisation ÷ {minutes} min"
          ],
          "F9": [
            "Carriers per hour",
            "60 ÷ {minutes} min = {carriersPerHour}"
          ],
          "F10": [
            "Machine-hour rate per carrier",
            "{rate} ÷ {carriersPerHour} carriers = {ratePerCarrier}"
          ],
          "F11": [
            "Staff cost per carrier",
            "load / unload time in min × workers × {wage} per hour ÷ 60"
          ],
          "F21": [
            "KTL paint",
            "D-KTL: {paintDktl} × m² · N-KTL: {paintNktl} × m²"
          ],
          "F22": [
            "Pre-treatment",
            "normal: {pretreatNormal} × m² · pickling: {pretreatBeizen} × m²"
          ],
          "F23": [
            "Material",
            "KTL paint + pre-treatment"
          ],
          "F24": [
            "Masking",
            "{masking} × number of masking points"
          ],
          "F25": [
            "Casting surcharge",
            "cast parts only: (price per part B25 + pickling B26) × {casting}"
          ],
          "F26": [
            "Production cost",
            "machine-hour rate per carrier ÷ pieces per carrier"
          ],
          "F27": [
            "Staff cost",
            "staff cost per carrier ÷ pieces per carrier"
          ],
          "F28": [
            "Overhead",
            "(material + production + staff) × {overhead}"
          ],
          "F29": [
            "Total",
            "material + masking + casting surcharge + production + staff + overhead"
          ],
          "F30": [
            "plus ETZ",
            "total × {etz}"
          ],
          "F32": [
            "Calculated price per part",
            "total + ETZ – only if staff cost > 0 (otherwise \"no staff costs\")"
          ],
          "B20": [
            "Weight per carrier",
            "pieces per carrier × weight in g ÷ 1000 (kg)"
          ],
          "B21": [
            "Revenue per carrier",
            "pieces per carrier × total of the old calculation (B29)"
          ],
          "B22": [
            "Revenue per m²",
            "total of the old calculation (B29) × 1,000,000 ÷ surface in mm²"
          ],
          "B23": [
            "Revenue per year",
            "offer price (empty: calculated price, rounded) × annual quantity"
          ],
          "F33": [
            "Carriers per day",
            "annual quantity ÷ ({workingDaysYear} days × pieces per carrier)"
          ],
          "F34": [
            "Carriers per year",
            "annual quantity ÷ pieces per carrier"
          ],
          "B25": [
            "Price per part",
            "{basePerCarrier} ÷ pieces per carrier + {basePerPart}"
          ],
          "B26": [
            "Pickling",
            "pickling only: {paintDktl} × m² (the Excel uses the D-KTL paint price H2 here)"
          ],
          "B27": [
            "Masking per part",
            "{masking} × number of masking points"
          ],
          "B28": [
            "Casting surcharge",
            "cast parts only: (B25 + B26) × {casting}"
          ],
          "B29": [
            "Total",
            "B25 + B26 + B27 + B28"
          ],
          "B32": [
            "Total / part by old calculation",
            "total × (1 + {etz} ETZ) – only if staff cost > 0"
          ],
          "L25": [
            "Hourly rate per carrier (table)",
            "{rate} ÷ {carriersTable} carriers per hour = {ratePerUnit}"
          ],
          "L26": [
            "Variable costs per carrier",
            "each variable cost: amount × KTL share ÷ {hoursKtl} h ÷ {carriersTable} – together {variablePerUnit}"
          ],
          "L27": [
            "Total per carrier",
            "{ratePerUnit} + {variablePerUnit} = {sumPerUnit}"
          ]
        }
      },
      "pulver": {
        "sections": {
          "target": "Target revenue (calculation defaults)",
          "surface": "Surface",
          "hanging": "Hanging & throughput",
          "price": "Price per part",
          "info": "For information"
        },
        "rows": {
          "H23": [
            "Target revenue without material per hour",
            "{targetBase} × {targetFactor} = {target}"
          ],
          "H7": [
            "Revenue per shift",
            "{usefulHours} h productive time × {target} = {perShift}"
          ],
          "B17": [
            "Surface from weight (mm², both sides)",
            "weight in g × 2000 ÷ (material thickness in mm × the material's density, steel {density} g/cm³)"
          ],
          "D20": [
            "Surface in mm²",
            "surface in cm² × 100"
          ],
          "B25": [
            "Hooks per metre",
            "1 ÷ (part length + {gap} m gap) – calculated with all decimals, two are shown (as in the Excel)"
          ],
          "H10": [
            "Parts per hour",
            "{speed} m/min × 60 × hooks per metre × parts per hook"
          ],
          "H11": [
            "Run time for the requested quantity",
            "requested quantity × 60 ÷ parts per hour (in minutes)"
          ],
          "B29": [
            "Price without material",
            "{target} ÷ parts per hour"
          ],
          "B33": [
            "Price without material incl. extras",
            "B29 + {plug} × plugs + {tape} × tapings"
          ],
          "H27": [
            "Powder per part",
            "surface in cm² × layer thickness ({layer} µm) × {powderDensity} g/cm³ ÷ ({transfer} × 10,000) – in g"
          ],
          "B34": [
            "Material",
            "powder in g × powder price per kg ÷ 1000"
          ],
          "B35": [
            "Price with material",
            "B33 + material"
          ],
          "B37": [
            "Calculated price incl. ETZ",
            "price with material × (1 + {etz} ETZ)"
          ],
          "D35": [
            "Material share",
            "material ÷ price with material (normal: {materialShare})"
          ],
          "H12": [
            "Revenue for the requested quantity",
            "requested quantity × price without material (B29)"
          ],
          "H17": [
            "Machine-hour rate per piece",
            "{machineRate} per hour ÷ parts per hour"
          ],
          "H20": [
            "Wage cost per piece",
            "{workers} workers × {wage} per hour ÷ parts per hour"
          ],
          "H30": [
            "Powder per shift",
            "powder per part × parts per hour × {usefulHours} h ÷ 1000 (kg)"
          ]
        }
      }
    },
    title: "Calculation settings",
    subtitle: "Fixed values of the Excel calculations – maintain once, used for every offer.",
    keyRate: "KTL machine-hour rate",
    area: "Section",
    tabCosts: "KTL · Costs & machine-hour rate",
    tabVariable: "KTL · Variable costs",
    tabParams: "KTL · Part calculation",
    tabPulver: "Powder · Settings",
    reset: "Reset {process} to Excel values",
    hours: "Hours per year (S5:T14)",
    hoursPerShift: "per shift (T6)",
    workingDays: "Working days (T7)",
    availability: "Availability (T8)",
    onePerYear: "one shift per year (T9)",
    shiftsKtl: "KTL shifts (L21)",
    shiftsPulver: "Powder shifts (N21)",
    shiftsSchaeumen: "Foaming shifts (P21)",
    carriersPerHour: "Carriers per hour (T13)",
    chainPerHour: "Metres of chain per hour (T14)",
    col: {
      name: "Item (I)",
      amount: "Amount (J)",
      ktlPct: "KTL % (M)",
      pulverPct: "Powder % (O)",
      schaeumenPct: "Foaming % (Q)",
      ktlEur: "KTL € (L)",
      pulverEur: "Powder € (N)",
      schaeumenEur: "Foaming € (P)",
      varName: "Item (V)",
      varAmount: "Amount (W)",
      varKtl: "KTL % (Z)",
      varPulver: "Powder % (AB)",
      varSchaeumen: "Foaming % (AD)",
      ktlHour: "KTL / hour (Y12)",
      ktlPerCarrier: "KTL / carrier (Y18)",
      pulverPerMetre: "Powder / metre (AA18)",
      schaeumen: "Foaming (AC18)",
    },
    row: {
      sum: "Total (row 20)",
      hours: "Hours per year (row 21)",
      rate: "Machine-hour rate (row 22)",
      ratePerUnit: "Hourly rate per carrier / metre of chain (row 25)",
      variablePerUnit: "Variable costs per carrier / metre (row 26)",
      sumPerUnit: "Total per carrier / metre (row 27)",
      variableSum: "Total per carrier / metre (row 22)",
    },
    variableNote: "These values are in the Excel in Y22 / L26 but are not part of the part price (F21–F32) – to be clarified in the meeting.",
    amountOf: "{name} amount",
    shareOf: "{name} {line}",
    costs: {
      f0: "Paint stripping",
      f1: "Christmas bonus provision",
      f2: "Salaries",
      f3: "Gas",
      f4: "Electricity",
      f5: "Repairs / maintenance",
      f6: "Forklift repairs",
      f7: "Waste disposal Remondis",
      f8: "External complaint costs",
      f9: "Haulage (third party)",
      f10: "Factoring fees",
      f11: "Other costs",
      f12: "Depreciation (AfA)",
      f13: "Interest (incl. factoring interest 7318)",
      v0: "Material",
      v1: "Wages",
      v2: "Subcontracting Oriones, Grace",
      v3: "Lebenshilfe (sheltered workshop)",
    },
    param: {
      carrierSurfaceM2: "Surface per carrier",
      minutesPerCarrier: "Time per carrier",
      utilisation: "Utilisation",
      wagePerHour: "Staff cost / hour",
      overhead: "Overhead",
      etz: "plus ETZ",
      paintDktl: "D-KTL paint",
      paintNktlFormula: "N-KTL paint (formula F21)",
      paintNktlTable: "N-KTL (table at the top)",
      pretreatNormal: "Pre-treatment, normal",
      pretreatBeizen: "Pickling (new calculation)",
      maskingPerPoint: "Masking per point",
      castingSurcharge: "Casting surcharge",
      basePerCarrier: "Old: amount per carrier",
      basePerPart: "Old: surcharge per part",
      densitySteel: "Density of steel",
      usefulHoursPerShift: "Productive time per shift",
      targetBase: "Target revenue (base)",
      targetFactor: "Factor without material",
      materialShare: "Normal material share",
      machineRate: "Machine-hour rate",
      workers: "Number of workers",
      pulverWage: "Hourly wage per worker",
      chainSpeed: "Chain speed",
      gapMetres: "Gap",
      layerUm: "Average layer thickness",
      powderDensity: "Powder density",
      transferEfficiency: "Transfer efficiency",
      coatingHeight: "Coating height",
      pricePerPlug: "Price per plug",
      pricePerTape: "Price per taping",
    },
    note: {
      alsoB26: "B26 (old pickling) also uses H2",
      h3Shows: "H3 shows 0.19",
      notCalculated: "not used in any calculation",
      textSays010: "label says 0.10",
      displayOnly: "display only",
      infoOnly: "for information only",
      inNoFormula: "in no formula",
    },
  },
  offer: {
    title: "Customer & offer",
    subtitleKtl: "KTL offer – recipient, numbers and letter texts.",
    subtitlePulver: "Powder offer – recipient, numbers and letter texts.",
    textsNote: "These texts are for the letter in {language}.",
    recipient: "Recipient",
    company: "Company",
    person: "Contact person (Mr / Ms …)",
    personPlaceholder: "Mr Michel",
    address: "Address",
    addressPlaceholder: "Street and no.\nPostcode city",
    offerSection: "Offer",
    project: "Project",
    offerNo: "Offer no.",
    requestDate: "Enquiry of",
    offerDate: "Offer date",
    calculatedBy: "Calculated by",
    spec: "Specification",
    notes: "Notes in the letter",
    terms: "Terms",
    label: "Label",
    noteN: "Note {n}",
    resetTexts: "Restore standard texts",
    languageName: "English",
  },
  // what went wrong in the background (Work Place) and the crash guard
  notice: {
    drawingNotStored: "The drawing was read and filled in, but could not be stored (database not reachable). \"Save\" will still store the offer.",
    customerNotRead: "The email was attached, but company, contact person, address and quantities could not be read from it - please fill them in yourself.",
    drawingLimit: "An offer can store at most 4 drawings – this one was filled in but not stored as a drawing.",
    offerNotFound: "This offer no longer exists (deleted in \"All Offers\"?). The offer you were working on stays open.",
    saveFailed: "The offer was not saved – the database could not be reached. Your entries are kept; please save again in a moment.",
    offerNotLoaded: "The offer could not be loaded (database not reachable). Please open it again later.",
    close: "Close notice",
  },
  crash: {
    title: "The offer could not be shown",
    text: "Something went wrong while showing it. Reloading usually fixes this; otherwise start a new offer – saved offers and drawings stay in \"All Offers\".",
    reload: "Reload",
    reset: "Start a new offer",
  },
  // Powder letter: the texts of "Angebot 32484-00014", shown in the layout of
  // Document Preview (KTL keeps Document Preview's own texts). withSpecNote is
  // the line Document Preview shows for "With specification".
  letter: {
    pulver: {
      spec: [
        ["Pre-treatment", "Degreasing, iron phosphating, demineralised-water rinse"],
        ["Coating", "Powder coating traffic white, smooth, matt RAL 9016, FreiLacke"],
        ["Layer thickness", "60 – 120 µm"],
      ],
      paragraphs: [
        "We can only confirm feasibility and the achievable coating quality after receiving the first sample parts and carrying out coating trials.",
        "We reserve the right to review this offer once we have received a packaging specification and assessed the packaging effort.",
        "Due to geometry and process, paint accumulations and runs beyond our control may occur on the offered part. Rework of these features is not included in this offer.",
        "Pro-rata one-off costs for an initial sample inspection report per VDA or PPAP: €500. Waived when the series order is placed. Special tests are charged at cost.",
      ],
      withSpecNote: "The offer price includes masking but does not include checking of thread functionality, fit accuracy or functional testing. Any tests required will be charged additionally.",
      terms: [
        ["Delivery", "Free to Elterlein, Am Gansberg 2"],
        ["Return delivery", "Ex works Elterlein, Am Gansberg 2"],
        ["Packaging", "In layers, in clean, stackable customer-owned containers provided free of charge."],
        ["Lead time", "Approx. 10 – 15 working days after receipt of goods and clarification of all open questions, or as specially agreed"],
        ["Payment", "30 days net"],
        ["Offer validity", "Subject to change"],
      ],
    },
  },
};

export default en;
