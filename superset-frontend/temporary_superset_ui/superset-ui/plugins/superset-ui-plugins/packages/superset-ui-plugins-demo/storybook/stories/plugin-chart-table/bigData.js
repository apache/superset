/* eslint-disable no-unused-vars */
/* eslint-disable no-magic-numbers */
/* eslint-disable sort-keys */
const ROW_COUNT = 30;
const COLUMN_COUNT = 20;

export const keys = ['ds'].concat(
  Array(COLUMN_COUNT)
    .fill(0)
    .map((_, i) => `clm ${i}`),
);

const item = {};
keys.forEach((key, i) => {
  item[key] = Array(i + 1)
    .fill(0)
    .join('');
});
item.ds = '2019-09-09';

export default Array(ROW_COUNT)
  .fill(0)
  .map(_ => ({ ...item }));
