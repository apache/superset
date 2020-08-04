const isEqual = (x, y) =>
  Array.isArray(x)
    ? Array.isArray(y) &&
      x.every(xi => y.includes(xi)) &&
      y.every(yi => x.includes(yi))
    : x === y;

const mergeRanges = rangeList => {
  const mergedQueue = [];
  const inputQueue = [...rangeList];
  while (inputQueue.length) {
    const cur = inputQueue.pop();
    const overlapIndex = mergedQueue.findIndex(
      item =>
        (item.start >= cur.start && item.start <= cur.end) ||
        (item.end >= cur.start && item.end <= cur.end)
    );

    if (overlapIndex === -1) {
      mergedQueue.push(cur);
    } else {
      const toMerge = mergedQueue.splice(overlapIndex, 1)[0];
      inputQueue.push({
        start: Math.min(cur.start, cur.end, toMerge.start, toMerge.end),
        end: Math.max(cur.start, cur.end, toMerge.start, toMerge.end),
      });
    }
  }

  return mergedQueue;
};

const sqr = x => x * x;
const mean = xs => xs.reduce((acc, x) => acc + x, 0) / xs.length;
const median = xs => xs.sort()[Math.floor(xs.length / 2)];
const variance = (xs, mean) =>
  xs.reduce((acc, x) => acc + sqr(x - mean), 0) / (xs.length - 1);
const range = xs =>
  xs.reduce(
    (acc, x) => ({
      start: Math.min(x, acc.start),
      end: Math.max(x, acc.end),
    }),
    { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY }
  );

module.exports.getModuleName = module => module.userRequest;

module.exports.getLoaderNames = loaders =>
  loaders && loaders.length
    ? loaders
        .map(l => l.loader || l)
        .map(l => l.replace(/^.*\/node_modules\/([^\/]+).*$/, (_, m) => m))
        .filter(l => !l.includes("speed-measure-webpack-plugin"))
    : ["modules with no loaders"];

module.exports.groupBy = (key, arr) => {
  const groups = [];
  (arr || []).forEach(arrItem => {
    const groupItem = groups.find(poss => isEqual(poss[0][key], arrItem[key]));
    if (groupItem) groupItem.push(arrItem);
    else groups.push([arrItem]);
  });

  return groups;
};

module.exports.getAverages = group => {
  const durationList = group.map(cur => cur.end - cur.start);

  const averages = {};
  averages.dataPoints = group.length;
  averages.median = median(durationList);
  averages.mean = Math.round(mean(durationList));
  averages.range = range(durationList);
  if (group.length > 1)
    averages.variance = Math.round(variance(durationList, averages.mean));

  return averages;
};

module.exports.getTotalActiveTime = group => {
  const mergedRanges = mergeRanges(group);
  return mergedRanges.reduce((acc, range) => acc + range.end - range.start, 0);
};

const prependLoader = rules => {
  if (!rules) return rules;
  if (Array.isArray(rules)) return rules.map(prependLoader);

  if (rules.loader) {
    rules.use = [rules.loader];
    delete rules.loader;
  }

  if (rules.use) {
    if (!Array.isArray(rules.use)) rules.use = [rules.use];
    rules.use.unshift("speed-measure-webpack-plugin/loader");
  }

  if (rules.oneOf) {
    rules.oneOf = prependLoader(rules.oneOf);
  }
  if (rules.rules) {
    rules.rules = prependLoader(rules.rules);
  }
  if (Array.isArray(rules.resource)) {
    rules.resource = prependLoader(rules.resource);
  }
  if (rules.resource && rules.resource.and) {
    rules.resource.and = prependLoader(rules.resource.and);
  }
  if (rules.resource && rules.resource.or) {
    rules.resource.or = prependLoader(rules.resource.or);
  }

  return rules;
};
module.exports.prependLoader = prependLoader;

module.exports.hackWrapLoaders = (loaderPaths, callback) => {
  const wrapReq = reqMethod => {
    return function() {
      const ret = reqMethod.apply(this, arguments);
      if (loaderPaths.includes(arguments[0])) {
        if (ret.__smpHacked) return ret;
        ret.__smpHacked = true;
        return callback(ret, arguments[0]);
      }
      return ret;
    };
  };

  if (typeof System === "object" && typeof System.import === "function") {
    System.import = wrapReq(System.import);
  }
  const Module = require("module");
  Module.prototype.require = wrapReq(Module.prototype.require);
};

const toCamelCase = s => s.replace(/(\-\w)/g, m => m[1].toUpperCase());
module.exports.tap = (obj, hookName, func) => {
  if (obj.hooks) {
    return obj.hooks[toCamelCase(hookName)].tap("smp", func);
  }
  return obj.plugin(hookName, func);
};
