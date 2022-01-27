(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















import createEncoderFactory from 'encodable/lib/encoders/createEncoderFactory';














export const lineEncoderFactory = createEncoderFactory({
  channelTypes: {
    x: 'X',
    y: 'Y',
    fill: 'Category',
    stroke: 'Color',
    strokeDasharray: 'Category',
    strokeWidth: 'Numeric' },

  defaultEncoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    fill: { value: false, legend: false },
    stroke: { value: '#222' },
    strokeDasharray: { value: '' },
    strokeWidth: { value: 1 } } });;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(lineEncoderFactory, "lineEncoderFactory", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/Line/Encoder.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();