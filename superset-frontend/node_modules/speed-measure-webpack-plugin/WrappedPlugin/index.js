let idInc = 0;

const genWrappedFunc = ({
  func,
  smp,
  context,
  timeEventName,
  pluginName,
  endType,
}) => (...args) => {
  const id = idInc++;
  // we don't know if there's going to be a callback applied to a particular
  // call, so we just set it multiple times, letting each one override the last
  const addEndEvent = () =>
    smp.addTimeEvent("plugins", timeEventName, "end", {
      id,
      // we need to allow failure, since webpack can finish compilation and
      // cause our callbacks to fall on deaf ears
      allowFailure: true,
    });

  smp.addTimeEvent("plugins", timeEventName, "start", {
    id,
    name: pluginName,
  });
  // invoke an end event immediately in case the callback here causes webpack
  // to complete compilation. If this gets invoked and not the subsequent
  // call, then our data will be inaccurate, sadly
  addEndEvent();
  const normalArgMap = a => wrap(a, pluginName, smp);
  let ret;
  if (endType === "wrapDone")
    ret = func.apply(
      context,
      args.map(a => wrap(a, pluginName, smp, addEndEvent))
    );
  else if (endType === "async") {
    const argsButLast = args.slice(0, args.length - 1);
    const callback = args[args.length - 1];
    ret = func.apply(
      context,
      argsButLast.map(normalArgMap).concat((...callbackArgs) => {
        addEndEvent();
        callback(...callbackArgs);
      })
    );
  } else if (endType === "promise")
    ret = func.apply(context, args.map(normalArgMap)).then(promiseArg => {
      addEndEvent();
      return promiseArg;
    });
  else ret = func.apply(context, args.map(normalArgMap));
  addEndEvent();

  return ret;
};

const genPluginMethod = (orig, pluginName, smp, type) =>
  function(method, func) {
    const timeEventName = pluginName + "/" + type + "/" + method;
    const wrappedFunc = genWrappedFunc({
      func,
      smp,
      context: this,
      timeEventName,
      pluginName,
      endType: "wrapDone",
    });
    return orig.plugin(method, wrappedFunc);
  };

const wrapTap = (tap, pluginName, smp, type, method) =>
  function(id, func) {
    const timeEventName = pluginName + "/" + type + "/" + method;
    const wrappedFunc = genWrappedFunc({
      func,
      smp,
      context: this,
      timeEventName,
      pluginName,
    });
    return tap.call(this, id, wrappedFunc);
  };

const wrapTapAsync = (tapAsync, pluginName, smp, type, method) =>
  function(id, func) {
    const timeEventName = pluginName + "/" + type + "/" + method;
    const wrappedFunc = genWrappedFunc({
      func,
      smp,
      context: this,
      timeEventName,
      pluginName,
      endType: "async",
    });
    return tapAsync.call(this, id, wrappedFunc);
  };

const wrapTapPromise = (tapPromise, pluginName, smp, type, method) =>
  function(id, func) {
    const timeEventName = pluginName + "/" + type + "/" + method;
    const wrappedFunc = genWrappedFunc({
      func,
      smp,
      context: this,
      timeEventName,
      pluginName,
      endType: "promise",
    });
    return tapPromise.call(this, id, wrappedFunc);
  };

const wrappedHooks = [];
const wrapHooks = (orig, pluginName, smp, type) => {
  const hooks = orig.hooks;
  if (!hooks) return hooks;
  const prevWrapped = wrappedHooks.find(
    w =>
      w.pluginName === pluginName && (w.orig === hooks || w.wrapped === hooks)
  );
  if (prevWrapped) return prevWrapped.wrapped;

  const genProxy = method => {
    const proxy = new Proxy(hooks[method], {
      get: (target, property) => {
        const raw = Reflect.get(target, property);

        if (property === "tap" && typeof raw === "function")
          return wrapTap(raw, pluginName, smp, type, method).bind(proxy);
        if (property === "tapAsync" && typeof raw === "function")
          return wrapTapAsync(raw, pluginName, smp, type, method).bind(proxy);
        if (property === "tapPromise" && typeof raw === "function")
          return wrapTapPromise(raw, pluginName, smp, type, method).bind(proxy);

        return raw;
      },
      set: (target, property, value) => {
        return Reflect.set(target, property, value);
      },
      deleteProperty: (target, property) => {
        return Reflect.deleteProperty(target, property);
      },
    });
    return proxy;
  };

  const wrapped = Object.keys(hooks).reduce((acc, method) => {
    acc[method] = genProxy(method);
    return acc;
  }, {});

  wrappedHooks.push({ orig: hooks, wrapped, pluginName });

  return wrapped;
};

const construcNamesToWrap = [
  "Compiler",
  "Compilation",
  "MainTemplate",
  "Parser",
  "NormalModuleFactory",
  "ContextModuleFactory",
];

const wrappedObjs = [];
const wrap = (orig, pluginName, smp, addEndEvent) => {
  if (!orig) return orig;
  const prevWrapped = wrappedObjs.find(
    w => w.pluginName === pluginName && (w.orig === orig || w.wrapped === orig)
  );
  if (prevWrapped) return prevWrapped.wrapped;

  const getOrigConstrucName = target =>
    target && target.constructor && target.constructor.name;
  const getShouldWrap = target => {
    const origConstrucName = getOrigConstrucName(target);
    return construcNamesToWrap.includes(origConstrucName);
  };
  const shouldWrap = getShouldWrap(orig);
  const shouldSoftWrap = Object.keys(orig)
    .map(k => orig[k])
    .some(getShouldWrap);

  let wrappedReturn;

  if (!shouldWrap && !shouldSoftWrap) {
    const vanillaFunc = orig.name === "next";
    wrappedReturn =
      vanillaFunc && addEndEvent
        ? function() {
            // do this before calling the callback, since the callback can start
            // the next plugin step
            addEndEvent();

            return orig.apply(this, arguments);
          }
        : orig;
  } else {
    const proxy = new Proxy(orig, {
      get: (target, property) => {
        const raw = Reflect.get(target, property);

        if (shouldWrap && property === "plugin")
          return genPluginMethod(
            target,
            pluginName,
            smp,
            getOrigConstrucName(target)
          ).bind(proxy);

        if (shouldWrap && property === "hooks")
          return wrapHooks(
            target,
            pluginName,
            smp,
            getOrigConstrucName(target)
          );

        if (typeof raw === "function") {
          const ret = raw.bind(proxy);
          if (property === "constructor")
            Object.defineProperty(ret, "name", {
              value: raw.name,
            });
          return ret;
        }

        return raw;
      },
      set: (target, property, value) => {
        return Reflect.set(target, property, value);
      },
      deleteProperty: (target, property) => {
        return Reflect.deleteProperty(target, property);
      },
    });

    wrappedReturn = proxy;
  }

  wrappedObjs.push({ pluginName, orig, wrapped: wrappedReturn });
  return wrappedReturn;
};

module.exports.clear = () => {
  wrappedObjs.length = 0;
  wrappedHooks.length = 0;
};

module.exports.WrappedPlugin = class WrappedPlugin {
  constructor(plugin, pluginName, smp) {
    this._smp_plugin = plugin;
    this._smp_pluginName = pluginName;
    this._smp = smp;

    this.apply = this.apply.bind(this);

    const wp = this;
    return new Proxy(plugin, {
      get(target, property) {
        if (property === "apply") {
          return wp.apply;
        }
        return target[property];
      },
      set: (target, property, value) => {
        return Reflect.set(target, property, value);
      },
      deleteProperty: (target, property) => {
        return Reflect.deleteProperty(target, property);
      },
    });
  }

  apply(compiler) {
    return this._smp_plugin.apply(
      wrap(compiler, this._smp_pluginName, this._smp)
    );
  }
};
