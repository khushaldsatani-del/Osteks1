// Fact label -> translation key, shared by the Specification popup (All
// Documents) and the Norm Library page. Any label not listed still renders,
// just with its raw underscored name as a readable fallback, so a new fact
// type can never make a row silently disappear.
export const FACT_LABEL_KEYS = {
  coating_thickness_range: "specificationModal.factCoatingThickness",
  cyclic_corrosion_cycles: "specificationModal.factCorrosionCycles",
  delamination_max: "specificationModal.factDelaminationMax",
  condensation_test_duration: "specificationModal.factCondensationDuration",
  corrosion_test_cycles: "specificationModal.factCorrosionTestCycles",
  corrosion_test_weeks: "specificationModal.factCorrosionTestWeeks",
  nss_test_duration: "specificationModal.factSaltSpray",
  cass_test_duration: "specificationModal.factCass",
  cross_cut: "specificationModal.factCrossCut",
  stone_chip: "specificationModal.factStoneChip",
  weathering: "specificationModal.factWeathering",
  coating_thickness_note: "specificationModal.factThicknessNote",
  requirement: "specificationModal.factRequirement",
};

export function factLabel(t, fact) {
  const key = FACT_LABEL_KEYS[fact.label];
  if (key) return t(key);
  return fact.label.replace(/_/g, " ");
}

