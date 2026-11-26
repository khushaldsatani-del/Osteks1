// The label of an input field by its key - for the price card's "still
// missing" / "please check" line. Form fields first, then the settings.
const FORM_KEYS = {
  ktl: {
    surfaceMm2: "ktl.surface",
    quantity: "ktl.quantity",
    weightG: "ktl.weight",
    thicknessMm: "ktl.thickness",
    maskingPoints: "ktl.masking",
    loadMinutes: "ktl.loadMinutes",
    workers: "ktl.workers",
    wagePerHour: "ktl.wage",
    minutesPerCarrier: "ktl.minutesPerCarrier",
  },
  pulver: {
    quantity: "pulver.quantity",
    weightG: "pulver.weight",
    thicknessMm: "pulver.thickness",
    surfaceCm2: "pulver.surface",
    powderPricePerKg: "pulver.powderPrice",
    partLengthM: "pulver.length",
    partsPerHook: "pulver.perHook",
    plugs: "pulver.plugs",
    tapes: "pulver.tapes",
    gapMetres: "pulver.gap",
    chainSpeed: "pulver.speed",
    layerUm: "pulver.layer",
    workers: "pulver.workers",
    wagePerHour: "pulver.wage",
  },
};

export const fieldLabel = (process, key, t) => t(FORM_KEYS[process]?.[key] ?? `settings.param.${key}`);

export const fieldList = (process, keys, t) => keys.map((key) => fieldLabel(process, key, t)).join(", ");
