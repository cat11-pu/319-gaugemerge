import assert from "node:assert";
import { register, totalOf } from "../gauges.js";
import { step, close } from "../gaugerun.js";
import { render } from "../app.js";

const base = {
  budget: 1, max_value: 1000000,
  state: { instances: [], total: 0, reports: 0, ledger: [], applied: [] },
  events: [{ id: 1, kind: "report", instance: "a", tick: 1, value: 5 }],
  stale_error_code: "E_STALE_REPORT", value_error_code: "E_BAD_VALUE",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("register returns instances", () => {
  assert.ok(Array.isArray(register([], "z", 1, 2)));
});

check("totalOf returns a number", () => {
  assert.strictEqual(typeof totalOf([["z", 1, 2]]), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
