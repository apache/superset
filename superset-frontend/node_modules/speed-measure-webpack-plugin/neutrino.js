const SpeedMeasurePlugin = require(".");
const smp = new SpeedMeasurePlugin();

module.exports = neutrino => {
  const origConfig = neutrino.config;
  const wrappedConfig = smp.wrap(origConfig.toConfig());
  neutrino.config = new Proxy(origConfig, {
    get(target, property) {
      if (property === "toConfig") {
        return () => wrappedConfig;
      }
      return target[property];
    },
  });
};
