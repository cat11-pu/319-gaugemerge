// gauges.js：实例表与合并值
// instances 每行是 [名字, 最后序号, 最新读数]；register 登记新实例，
// 或在序号严格大于上次时覆盖读数。
export function register(instances, name, tick, value) {
  for (let i = 0; i < instances.length; i += 1) {
    if (instances[i][0] === name) {
      if (!(tick > instances[i][1])) {
        const error = new Error("stale report: tick " + tick + " <= last " + instances[i][1]);
        error.code = "E_STALE_REPORT";
        throw error;
      }
      const next = instances.slice();
      next[i] = [name, tick, value];
      return next;
    }
  }
  return instances.concat([[name, tick, value]]);
}

export function totalOf(instances) {
  return instances.reduce(function (sum, row) { return sum + row[2]; }, 0);
}
