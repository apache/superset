/* eslint-disable no-unused-vars */
/* eslint-disable no-magic-numbers */
/* eslint-disable sort-keys */
const LONG_STRING = `The quick brown fox jumps over the lazy dog`;
const SHORT_STRING = 'Superset';

const ROW_COUNT = 30;
const COLUMN_COUNT = 20;

export const keys = Array(COLUMN_COUNT)
  .fill(0)
  .map((_, i) => `Column Name ${i}`);

const item = {};
keys.forEach(key => {
  item[key] = Math.random() < 0.5 ? LONG_STRING : SHORT_STRING;
});

export default Array(ROW_COUNT)
  .fill(0)
  .map(_ => ({ ...item }));
