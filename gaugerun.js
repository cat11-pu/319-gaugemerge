// gaugerun.js：按处理预算处理事件，用尽预算后连着载压在账上，收尾不限预算清账。
import { register, totalOf } from "./gauges.js";

const DEFAULT_CODES = {
  stale: "E_STALE_REPORT",
  value: "E_BAD_VALUE",
  event: "E_BAD_EVENT"
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isNonNegativeInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function codeOf(spec, key) {
  const map = {
    stale: spec.stale_error_code,
    value: spec.value_error_code,
    event: spec.event_error_code
  };
  return map[key] || DEFAULT_CODES[key];
}

// 事件结构：kind 必须是 "report"，带字符串 instance、正整数 tick、非负整数 value。
// 结构问题先整批校验（与预算无关），报 E_BAD_EVENT。
function checkShape(event, spec) {
  const code = codeOf(spec, "event");
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    fail(code, "event must be an object");
  }
  if (event.kind !== "report" || typeof event.instance !== "string" || event.instance === "") {
    fail(code, "event must be a report with an instance name");
  }
  if (!isPositiveInt(event.tick)) {
    fail(code, "event tick must be a positive integer");
  }
  if (!isNonNegativeInt(event.value)) {
    fail(code, "event value must be a non-negative integer");
  }
}

function checkValue(event, spec) {
  const maxValue = isNonNegativeInt(spec.max_value) ? spec.max_value : Number.MAX_SAFE_INTEGER;
  if (event.value > maxValue) {
    fail(codeOf(spec, "value"), "value " + event.value + " exceeds max " + maxValue);
  }
}

// 账上与已处理集合里都只放 [kind, instance, tick, value] 四元组。
function tupleOf(event) {
  return [event.kind, event.instance, event.tick, event.value];
}

function cloneState(state) {
  return {
    instances: state.instances.map(function (row) { return [row[0], row[1], row[2]]; }),
    total: state.total,
    reports: state.reports,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    applied: state.applied.map(function (row) { return row.slice(); })
  };
}

function budgetOf(spec) {
  const value = Number(spec.budget);
  if (!Number.isFinite(value) || value <= 0) { return 0; }
  return Math.floor(value);
}

// 真处理（判合法性 + 登记），返回新状态；不合法直接抛错。
function accept(state, tuple, spec) {
  const pseudo = { kind: tuple[0], instance: tuple[1], tick: tuple[2], value: tuple[3] };
  let instances = state.instances;
  try {
    instances = register(state.instances, pseudo.instance, pseudo.tick, pseudo.value);
  } catch (error) {
    if (error && error.code === "E_STALE_REPORT") {
      fail(codeOf(spec, "stale"), error.message);
    }
    throw error;
  }
  checkValue(pseudo, spec);
  return {
    instances: instances,
    total: totalOf(instances),
    reports: state.reports + 1,
    applied: state.applied.concat([tuple])
  };
}

// 按 budget 依次消费队列；已处理过的四元组直接跳过（不占预算、不留账）。
// 返回 { state, served }。
function consume(state, queue, budget, spec) {
  let next = state;
  let remaining = budget;
  let served = 0;
  const leftovers = [];

  queue.forEach(function (tuple) {
    if (next.applied.some(function (row) {
      return row.length === tuple.length && row.every(function (v, i) { return v === tuple[i]; });
    })) {
      return;
    }
    if (remaining > 0) {
      remaining -= 1;
      next = accept(next, tuple, spec);
      served += 1;
    } else {
      leftovers.push(tuple);
    }
  });

  return {
    state: {
      instances: next.instances,
      total: next.total,
      reports: next.reports,
      ledger: leftovers,
      applied: next.applied
    },
    served: served
  };
}

export function step(spec) {
  const events = spec.events || [];
  events.forEach(function (event) { checkShape(event, spec); });

  const before = cloneState(spec.state);
  const queue = before.ledger.concat(events.map(tupleOf));
  const result = consume(before, queue, budgetOf(spec), spec);

  return {
    state: result.state,
    served: result.served,
    ledger_before: result.state.ledger.length,
    ledger: result.state.ledger,
    judged: result.served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const before = cloneState(spec.state);
  const result = consume(before, before.ledger, Number.POSITIVE_INFINITY, spec);
  return { state: result.state, catchup: result.served };
}
