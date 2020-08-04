// TODO - formatGLSLCompilerError should not depend on this
import getShaderName from './get-shader-name';
import getShaderTypeName from './get-shader-type-name';

// Formats GLSL compiler error log into single string
export default function formatGLSLCompilerError(errLog, src, shaderType) {
  const {shaderName, errors, warnings} = parseGLSLCompilerError(errLog, src, shaderType);
  return `GLSL compilation error in ${shaderName}\n\n${errors}\n${warnings}`;
}

/**
 * Parse a GLSL compiler error log into a string showing the source code around each error.
 * Based on https://github.com/wwwtyro/gl-format-compiler-error (public domain)
 */
/* eslint-disable no-continue, max-statements */
export function parseGLSLCompilerError(errLog, src, shaderType, shaderName) {
  const errorStrings = errLog.split(/\r?\n/);
  const errors = {};
  const warnings = {};

  // Patch the shader name
  const name = shaderName || getShaderName(src) || '(unnamed)';
  const shaderDescription = `${getShaderTypeName(shaderType)} shader ${name}`;

  // Parse the error - note: browser and driver dependent
  for (let i = 0; i < errorStrings.length; i++) {
    const errorString = errorStrings[i];
    if (errorString.length <= 1) {
      continue;
    }
    const segments = errorString.split(':');
    const type = segments[0];
    const line = parseInt(segments[2], 10);
    if (isNaN(line)) {
      throw new Error(`GLSL compilation error in ${shaderDescription}: ${errLog}`);
    }
    if (type !== 'WARNING') {
      errors[line] = errorString;
    } else {
      warnings[line] = errorString;
    }
  }

  // Format the error inline with the code
  const lines = addLineNumbers(src);

  return {
    shaderName: shaderDescription,
    errors: formatErrors(errors, lines),
    warnings: formatErrors(warnings, lines)
  };
}

// helper function, outputs annotated errors or warnings
function formatErrors(errors, lines) {
  let message = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!errors[i + 3] && !errors[i + 2] && !errors[i + 1]) {
      continue;
    }
    message += `${line}\n`;
    if (errors[i + 1]) {
      const error = errors[i + 1];
      const segments = error.split(':', 3);
      const type = segments[0];
      const column = parseInt(segments[1], 10) || 0;
      const err = error.substring(segments.join(':').length + 1).trim();
      message += padLeft(`^^^ ${type}: ${err}\n\n`, column);
    }
  }
  return message;
}

/**
 * Prepends line numbers to each line of a string.
 * The line numbers will be left-padded with spaces to ensure an
 * aligned layout when rendered using monospace fonts.
 * @param {String} string - multi-line string to add line numbers to
 * @param {Number} start=1 - number of spaces to add
 * @param {String} delim =': ' - injected between line number and original line
 * @return {String[]} strings - array of string, one per line, with line numbers added
 */
function addLineNumbers(string, start = 1, delim = ': ') {
  const lines = string.split(/\r?\n/);
  const maxDigits = String(lines.length + start - 1).length;
  return lines.map((line, i) => {
    const lineNumber = i + start;
    const digits = String(lineNumber).length;
    const prefix = padLeft(lineNumber, maxDigits - digits);
    return prefix + delim + line;
  });
}

/**
 * Pads a string with a number of spaces (space characters) to the left
 * @param {String} string - string to pad
 * @param {Number} digits - number of spaces to add
 * @return {String} string - The padded string
 */
function padLeft(string, digits) {
  let result = '';
  for (let i = 0; i < digits; ++i) {
    result += ' ';
  }
  return `${result}${string}`;
}
