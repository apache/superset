// TODO: Currently unused, keeping in case we want it later for log formatting
export function formatTime(ms) {
  let formatted;
  if (ms < 10) {
    formatted = `${ms.toFixed(2)}ms`;
  } else if (ms < 100) {
    formatted = `${ms.toFixed(1)}ms`;
  } else if (ms < 1000) {
    formatted = `${ms.toFixed(0)}ms`;
  } else {
    formatted = `${(ms / 1000).toFixed(2)}s`;
  }
  return formatted;
}

export function leftPad(string, length = 8) {
  const padLength = Math.max(length - string.length, 0);
  return `${' '.repeat(padLength)}${string}`;
}

export function rightPad(string, length = 8) {
  const padLength = Math.max(length - string.length, 0);
  return `${string}${' '.repeat(padLength)}`;
}

// Breaks a number into a normalized base and an exponent
// E.g. 5640 => {5.64, 1000}
function splitIntoBaseAndExponent(number) {
  let base = number;
  let exponent = 0;
  if (number !== 0) {
    while (base >= 10 || base <= -10) {
      base /= 10;
      exponent++;
    }
    while (base < 1 && base > -1) {
      base *= 10;
      exponent--;
    }
  }
  return {base, exponent};
}

export function getSISuffix(multipleOf3) {
  const SI_SUFFIXES = {0: '', 1: 'K', 2: 'M', 3: 'G', '-1': 'm', '-2': 'µ', '-3': 'n'};
  const key = String(multipleOf3);
  return key in SI_SUFFIXES ? SI_SUFFIXES[key] : `e${multipleOf3 * 3}`;
}

export function formatSI(number, precision = 3) {
  const {base, exponent} = splitIntoBaseAndExponent(number);
  const multipleOf3 = Math.floor(exponent / 3);
  const remaining = exponent - multipleOf3 * 3;
  const digits = base * Math.pow(10, remaining);
  return `${digits.toPrecision(precision)}${getSISuffix(multipleOf3)}`;
}

export function formatValue(v, opts = {}) {
  const EPSILON = 1e-16;
  const {isInteger = false} = opts;
  if (Array.isArray(v) || ArrayBuffer.isView(v)) {
    return formatArrayValue(v, opts);
  }
  if (!Number.isFinite(v)) {
    return String(v);
  }
  if (Math.abs(v) < EPSILON) {
    return isInteger ? '0' : '0.';
  }
  if (isInteger) {
    return v.toFixed(0);
  }
  if (Math.abs(v) > 100 && Math.abs(v) < 10000) {
    return v.toFixed(0);
  }
  const string = v.toPrecision(2);
  const decimal = string.indexOf('.0');
  return decimal === string.length - 2 ? string.slice(0, -1) : string;
}

// Helper to formatValue
function formatArrayValue(v, opts) {
  const {maxElts = 16, size = 1} = opts;
  let string = '[';
  for (let i = 0; i < v.length && i < maxElts; ++i) {
    if (i > 0) {
      string += `,${(i % size === 0) ? ' ' : ''}`;
    }
    string += formatValue(v[i], opts);
  }
  const terminator = v.length > maxElts ? '...' : ']';
  return `${string}${terminator}`;
}

// Inspired by https://github.com/hughsk/console-image (MIT license)
export function formatImage(image, message, scale, maxWidth = 600) {
  const imageUrl = image.src.replace(/\(/g, '%28').replace(/\)/g, '%29');

  if (image.width > maxWidth) {
    scale = Math.min(scale, maxWidth / image.width);
  }

  const width = image.width * scale;
  const height = image.height * scale;

  const style = [
    'font-size:1px;',
    `padding:${Math.floor(height / 2)}px ${Math.floor(width / 2)}px;`,
    `line-height:${height}px;`,
    `background:url(${imageUrl});`,
    `background-size:${width}px ${height}px;`,
    'color:transparent;'
  ].join('');

  return [`${message} %c+`, style];
}
