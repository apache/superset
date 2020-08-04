const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const { WrappedPlugin, clear } = require("./WrappedPlugin");
const {
  getModuleName,
  getLoaderNames,
  prependLoader,
  tap,
} = require("./utils");
const {
  getHumanOutput,
  getMiscOutput,
  getPluginsOutput,
  getLoadersOutput,
  smpTag,
} = require("./output");

const NS = path.dirname(fs.realpathSync(__filename));

module.exports = class SpeedMeasurePlugin {
  constructor(options) {
    this.options = options || {};

    this.timeEventData = {};
    this.smpPluginAdded = false;

    this.wrap = this.wrap.bind(this);
    this.getOutput = this.getOutput.bind(this);
    this.addTimeEvent = this.addTimeEvent.bind(this);
    this.apply = this.apply.bind(this);
    this.provideLoaderTiming = this.provideLoaderTiming.bind(this);
  }

  wrap(config) {
    if (this.options.disable) return config;
    if (Array.isArray(config)) return config.map(this.wrap);
    if (typeof config === "function")
      return (...args) => this.wrap(config(...args));

    config.plugins = (config.plugins || []).map(plugin => {
      const pluginName =
        Object.keys(this.options.pluginNames || {}).find(
          pluginName => plugin === this.options.pluginNames[pluginName]
        ) ||
        (plugin.constructor && plugin.constructor.name) ||
        "(unable to deduce plugin name)";
      return new WrappedPlugin(plugin, pluginName, this);
    });

    if (config.module && this.options.granularLoaderData) {
      config.module = prependLoader(config.module);
    }

    if (!this.smpPluginAdded) {
      config.plugins = config.plugins.concat(this);
      this.smpPluginAdded = true;
    }

    return config;
  }

  getOutput() {
    const outputObj = {};
    if (this.timeEventData.misc)
      outputObj.misc = getMiscOutput(this.timeEventData.misc);
    if (this.timeEventData.plugins)
      outputObj.plugins = getPluginsOutput(this.timeEventData.plugins);
    if (this.timeEventData.loaders)
      outputObj.loaders = getLoadersOutput(this.timeEventData.loaders);

    if (this.options.outputFormat === "json")
      return JSON.stringify(outputObj, null, 2);
    if (typeof this.options.outputFormat === "function")
      return this.options.outputFormat(outputObj);
    return getHumanOutput(outputObj, {
      verbose: this.options.outputFormat === "humanVerbose",
    });
  }

  addTimeEvent(category, event, eventType, data = {}) {
    const allowFailure = data.allowFailure;
    delete data.allowFailure;

    const tED = this.timeEventData;
    if (!tED[category]) tED[category] = {};
    if (!tED[category][event]) tED[category][event] = [];
    const eventList = tED[category][event];
    const curTime = new Date().getTime();

    if (eventType === "start") {
      data.start = curTime;
      eventList.push(data);
    } else if (eventType === "end") {
      const matchingEvent = eventList.find(e => {
        const allowOverwrite = !e.end || !data.fillLast;
        const idMatch = e.id !== undefined && e.id === data.id;
        const nameMatch =
          !data.id && e.name !== undefined && e.name === data.name;
        return allowOverwrite && (idMatch || nameMatch);
      });
      const eventToModify =
        matchingEvent || (data.fillLast && eventList.find(e => !e.end));
      if (!eventToModify) {
        console.error(
          "Could not find a matching event to end",
          category,
          event,
          data
        );
        if (allowFailure) return;
        throw new Error("No matching event!");
      }

      eventToModify.end = curTime;
    }
  }

  apply(compiler) {
    if (this.options.disable) return;

    tap(compiler, "compile", () => {
      this.addTimeEvent("misc", "compile", "start", { watch: false });
    });
    tap(compiler, "done", () => {
      clear();
      this.addTimeEvent("misc", "compile", "end", { fillLast: true });

      const outputToFile = typeof this.options.outputTarget === "string";
      chalk.enabled = !outputToFile;
      const output = this.getOutput();
      chalk.enabled = true;
      if (outputToFile) {
        const writeMethod = fs.existsSync(this.options.outputTarget)
          ? fs.appendFile
          : fs.writeFile;
        writeMethod(this.options.outputTarget, output + "\n", err => {
          if (err) throw err;
          console.log(
            smpTag() + "Outputted timing info to " + this.options.outputTarget
          );
        });
      } else {
        const outputFunc = this.options.outputTarget || console.log;
        outputFunc(output);
      }

      this.timeEventData = {};
    });

    tap(compiler, "compilation", compilation => {
      tap(compilation, "normal-module-loader", loaderContext => {
        loaderContext[NS] = this.provideLoaderTiming;
      });

      tap(compilation, "build-module", module => {
        const name = getModuleName(module);
        if (name) {
          this.addTimeEvent("loaders", "build", "start", {
            name,
            fillLast: true,
            loaders: getLoaderNames(module.loaders),
          });
        }
      });

      tap(compilation, "succeed-module", module => {
        const name = getModuleName(module);
        if (name) {
          this.addTimeEvent("loaders", "build", "end", {
            name,
            fillLast: true,
          });
        }
      });
    });
  }

  provideLoaderTiming(info) {
    const infoData = { id: info.id };
    if (info.type !== "end") {
      infoData.loader = info.loaderName;
      infoData.name = info.module;
    }

    this.addTimeEvent("loaders", "build-specific", info.type, infoData);
  }
};
