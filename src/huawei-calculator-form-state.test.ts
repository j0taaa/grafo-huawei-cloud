import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatorFormSignature,
  canonicalizeCalculatorOption,
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
