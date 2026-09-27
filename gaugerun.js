// gaugerun.js：按处理预算处理并留账
import { register, totalOf } from "./gauges.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const source = state || {};
  return {
    instances: (source.instances || []).map(function (row) { return row.slice(); }),
    total: source.total || 0,
    reports: source.reports || 0,
    ledger: (source.ledger || []).map(function (row) { return Array.isArray(row) ? row.slice() : row; }),
    applied: (source.applied || []).slice()
  };
}

function eventKey(event) {
  if (event.id !== undefined) return event.id;
  return JSON.stringify([event.kind, event.instance, event.tick, event.value]);
}

function checkShape(event) {
  const ok = event !== null && typeof event === "object" && !Array.isArray(event)
    && event.kind === "report"
    && typeof event.instance === "string" && event.instance.length > 0
    && Number.isInteger(event.tick) && event.tick >= 0
    && typeof event.value === "number";
  if (!ok) fail("E_BAD_EVENT", "事件结构不合法");
}

function applyEvent(state, event, maxValue) {
  const value = event.value;
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER
      || (maxValue !== undefined && value > maxValue)) {
    fail("E_BAD_VALUE", "读数超过上限");
  }
  register(state.instances, event.instance, event.tick, value);
  state.reports += 1;
  state.total = totalOf(state.instances);
  state.applied.push(eventKey(event));
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const budget = spec.budget;
  for (const event of events) checkShape(event);
  let served = 0;
  let judged = 0;
  for (const event of events) {
    if (state.applied.indexOf(eventKey(event)) !== -1) continue;
    judged += 1;
    if (served >= budget) {
      state.ledger.push([event.kind, event.instance, event.tick, event.value, event.id]);
      continue;
    }
    applyEvent(state, event, spec.max_value);
    served += 1;
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(0, 4); }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    const event = Array.isArray(row)
      ? { id: row[4], kind: row[0], instance: row[1], tick: row[2], value: row[3] }
      : row;
    applyEvent(state, event, spec.max_value);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
