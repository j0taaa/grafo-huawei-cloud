import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCandidateCalculatorActions,
  calculatorFormSignature,
  canonicalizeCalculatorOption,
  getDeepestMultiOptionControl,
  type CalculatorFormControl,
} from "./huawei-calculator-form-state.js";

test("calculatorFormSignature distinguishes button-group current selection", () => {
  const a: CalculatorFormControl[] = [
    {
      rowIndex: 0,
      kind: "button-group",
      label: "DB Instance Class",
      current: "General-purpose",
      options: ["General-purpose", "Dedicated"],
    },
  ];
  const b: CalculatorFormControl[] = [
    {
      rowIndex: 0,
      kind: "button-group",
      label: "DB Instance Class",
      current: "Dedicated",
      options: ["General-purpose", "Dedicated"],
    },
  ];
  assert.notEqual(calculatorFormSignature(a), calculatorFormSignature(b));
});

test("calculatorFormSignature distinguishes select option lists", () => {
  const a: CalculatorFormControl[] = [
    {
      rowIndex: 1,
      kind: "select",
      label: "Instance specification",
      current: "2 vCPUs",
      options: ["2 vCPUs", "4 vCPUs"],
    },
  ];
  const b: CalculatorFormControl[] = [
    {
      rowIndex: 1,
      kind: "select",
      label: "Instance specification",
      current: "2 vCPUs",
      options: ["2 vCPUs", "4 vCPUs", "96vCPUs, 192GB"],
    },
  ];
  assert.notEqual(calculatorFormSignature(a), calculatorFormSignature(b));
});

test("canonicalizeCalculatorOption normalizes Required Duration", () => {
  assert.equal(canonicalizeCalculatorOption("Required Duration", "1 month"), "1");
  assert.equal(canonicalizeCalculatorOption("Required Duration", "3 months"), "3");
});

test("getDeepestMultiOptionControl picks last row among multi-option controls", () => {
  const controls: CalculatorFormControl[] = [
    {
      rowIndex: 1,
      kind: "button-group",
      label: "Billing",
      current: "A",
      options: ["A", "B"],
    },
    {
      rowIndex: 57,
      kind: "button-group",
      label: "Required Duration",
      current: "1",
      options: ["1", "2", "3"],
    },
  ];
  const d = getDeepestMultiOptionControl(controls);
  assert.equal(d?.label, "Required Duration");
});

test("buildCandidateCalculatorActions skips deepest multi-option control by default", () => {
  const controls: CalculatorFormControl[] = [
    {
      rowIndex: 1,
      kind: "button-group",
      label: "Billing",
      current: "A",
      options: ["A", "B"],
    },
    {
      rowIndex: 57,
      kind: "button-group",
      label: "Required Duration",
      current: "1",
      options: ["1", "2", "3"],
    },
  ];
  const actions = buildCandidateCalculatorActions(controls);
  const labels = new Set(actions.map((a) => a.label));
  assert.equal(labels.has("Required Duration"), false);
  assert.equal(labels.has("Billing"), true);
});

test("buildCandidateCalculatorActions includes deepest when HUAWEI_AUTOMATON_EXPLORE_LAST_CONTROL=1", () => {
  const controls: CalculatorFormControl[] = [
    {
      rowIndex: 1,
      kind: "button-group",
      label: "Billing",
      current: "A",
      options: ["A", "B"],
    },
    {
      rowIndex: 57,
      kind: "button-group",
      label: "Required Duration",
      current: "1",
      options: ["1", "2", "3"],
    },
  ];
  process.env.HUAWEI_AUTOMATON_EXPLORE_LAST_CONTROL = "1";
  try {
    const actions = buildCandidateCalculatorActions(controls);
    assert.ok(actions.some((a) => a.label === "Required Duration"));
  } finally {
    delete process.env.HUAWEI_AUTOMATON_EXPLORE_LAST_CONTROL;
  }
});

test("calculatorFormSignature distinguishes checkbox slots on the same row", () => {
  const a: CalculatorFormControl[] = [
    {
      rowIndex: 2,
      kind: "checkbox",
      label: "Add-on — Option A",
      current: "unchecked",
      options: ["unchecked", "checked"],
      checkboxIndex: 0,
    },
    {
      rowIndex: 2,
      kind: "checkbox",
      label: "Add-on — Option B",
      current: "unchecked",
      options: ["unchecked", "checked"],
      checkboxIndex: 1,
    },
  ];
  const b: CalculatorFormControl[] = [
    {
      rowIndex: 2,
      kind: "checkbox",
      label: "Add-on — Option A",
      current: "checked",
      options: ["unchecked", "checked"],
      checkboxIndex: 0,
    },
    {
      rowIndex: 2,
      kind: "checkbox",
      label: "Add-on — Option B",
      current: "unchecked",
      options: ["unchecked", "checked"],
      checkboxIndex: 1,
    },
  ];
  assert.notEqual(calculatorFormSignature(a), calculatorFormSignature(b));
});
