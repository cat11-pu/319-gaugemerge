// gauges.js：实例表与合并值
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function register(instances, name, tick, value) {
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    fail("E_BAD_VALUE", "读数必须是非负整数且不超过可表示上限");
  }
  for (const row of instances) {
    if (row[0] === name) {
      if (!(tick > row[1])) {
        fail("E_STALE_REPORT", "序号必须比该实例上次的大");
      }
      row[1] = tick;
      row[2] = value;
      return instances;
    }
  }
  instances.push([name, tick, value]);
  return instances;
}

export function totalOf(instances) {
  let total = 0;
  for (const row of instances) {
    total += row[2];
  }
  return total;
}
