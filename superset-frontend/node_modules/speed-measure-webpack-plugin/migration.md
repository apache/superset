# Migration Guide

SMP follows [semver](https://semver.org/). This guide should help with upgrading major versions.

## v0 → v1

### If Using Static Constructor

If you're using the  `SpeedMeasurePlugin.wrapPlugins(plugins, options)` static method, then

 * remove all `.wrapPlugins` calls
 * instantiate an `smp`
 * call `smp.wrap` on your entire config

e.g.

```javascript
// v0
const webpackConfig = {
  plugins: SpeedMeasurePlugin.wrapPlugins({
    FooPlugin: new FooPlugin()
  }, smpOptions)
};

// v1
const smp = new SpeedMeasurePlugin(smpOptions);
const webpackConfig = smp.wrap({
  plugins: [new FooPlugin()]
});
```

### If Using `smp` Instance

If you're using the `smp.wrapPlugins(plugins)` method, then

 * remove all `.wrapPlugins` calls
 * call `smp.wrap` on your entire config

e.g.

```javascript
// v0
const smp = new SpeedMeasurePlugin(smpOptions);
const webpackConfig = {
  plugins: smp.wrapPlugins({
    FooPlugin: new FooPlugin()
  })
};

// v1
const smp = new SpeedMeasurePlugin(smpOptions);
const webpackConfig = smp.wrap({
  plugins: [new FooPlugin()]
});
```

### If Using Custom Names

v1 no longer requires you to manually enter each plugin name. If you want to keep any of your custom plugin names, then you can use the new `options.pluginNames` option:

```javascript
const fooPlugin = new FooPlugin();
const smp = new SpeedMeasurePlugin({
  pluginNames: {
    customFooPluginName: fooPlugin
  }
});
const webpackConfig = smp.wrap({
  plugins: [fooPlugin]
});
```
