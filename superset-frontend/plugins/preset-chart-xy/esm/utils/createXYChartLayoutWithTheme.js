(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















import XYChartLayout from './XYChartLayout';

export default function createXYChartLayoutWithTheme(



config)


{
  const { theme, ...rest } = config;

  return new XYChartLayout({
    ...rest,
    // @ts-ignore
    xTickSize: theme.xTickStyles.length || theme.xTickStyles.tickLength,
    xTickTextStyle:
    theme.xTickStyles.label.bottom || theme.xTickStyles.label.top,
    // @ts-ignore
    yTickSize: theme.yTickStyles.length || theme.yTickStyles.tickLength,
    yTickTextStyle:
    theme.yTickStyles.label.left || theme.yTickStyles.label.right });

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(createXYChartLayoutWithTheme, "createXYChartLayoutWithTheme", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/utils/createXYChartLayoutWithTheme.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();