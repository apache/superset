const wrap = method => function(value, spec) {
  const locale = this.context.dataflow.locale();
  return locale[method](spec)(value);
};

export const format = wrap('format');
export const timeFormat = wrap('timeFormat');
export const utcFormat = wrap('utcFormat');
export const timeParse = wrap('timeParse');
export const utcParse = wrap('utcParse');

var dateObj = new Date(2000, 0, 1);

function time(month, day, specifier) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return '';
  dateObj.setYear(2000);
  dateObj.setMonth(month);
  dateObj.setDate(day);
  return timeFormat.call(this, dateObj, specifier);
}

export function monthFormat(month) {
  return time.call(this, month, 1, '%B');
}

export function monthAbbrevFormat(month) {
  return time.call(this, month, 1, '%b');
}

export function dayFormat(day) {
  return time.call(this, 0, 2 + day, '%A');
}

export function dayAbbrevFormat(day) {
  return time.call(this, 0, 2 + day, '%a');
}
