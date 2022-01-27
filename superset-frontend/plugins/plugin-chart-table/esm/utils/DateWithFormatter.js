(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};



















const REGEXP_TIMESTAMP_NO_TIMEZONE = /T(\d{2}:){2}\d{2}$/;

/**
 * Extended Date object with a custom formatter, and retains the original input
 * when the formatter is simple `String(..)`.
 */
export default class DateWithFormatter extends Date {




  constructor(
  input,
  {
    formatter = String,
    forceUTC = true } =
  {})
  {
    let value = input;
    // assuming timestamps without a timezone is in UTC time
    if (
    forceUTC &&
    typeof value === 'string' &&
    REGEXP_TIMESTAMP_NO_TIMEZONE.test(value))
    {
      value = `${value}Z`;
    }

    super(value);this.formatter = void 0;this.input = void 0;

    this.input = input;
    this.formatter = formatter;
    this.toString = () => {
      if (this.formatter === String) {
        return String(this.input);
      }
      return this.formatter ? this.formatter(this) : Date.toString.call(this);
    };
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(REGEXP_TIMESTAMP_NO_TIMEZONE, "REGEXP_TIMESTAMP_NO_TIMEZONE", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/utils/DateWithFormatter.ts");reactHotLoader.register(DateWithFormatter, "DateWithFormatter", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/utils/DateWithFormatter.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();