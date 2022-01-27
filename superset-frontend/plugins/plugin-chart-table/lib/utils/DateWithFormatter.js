const REGEXP_TIMESTAMP_NO_TIMEZONE = /T(\d{2}:){2}\d{2}$/;
/**
 * Extended Date object with a custom formatter, and retains the original input
 * when the formatter is simple `String(..)`.
 */
export default class DateWithFormatter extends Date {
    formatter;
    input;
    constructor(input, { formatter = String, forceUTC = true, } = {}) {
        let value = input;
        // assuming timestamps without a timezone is in UTC time
        if (forceUTC &&
            typeof value === 'string' &&
            REGEXP_TIMESTAMP_NO_TIMEZONE.test(value)) {
            value = `${value}Z`;
        }
        super(value);
        this.input = input;
        this.formatter = formatter;
        this.toString = () => {
            if (this.formatter === String) {
                return String(this.input);
            }
            return this.formatter ? this.formatter(this) : Date.toString.call(this);
        };
    }
}
//# sourceMappingURL=DateWithFormatter.js.map