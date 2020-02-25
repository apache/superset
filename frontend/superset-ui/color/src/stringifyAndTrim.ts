/**
 * Ensure value is a string
 * @param {any} value
 */
export default function stringifyAndTrim(value?: number | string) {
  return String(value).trim();
}
