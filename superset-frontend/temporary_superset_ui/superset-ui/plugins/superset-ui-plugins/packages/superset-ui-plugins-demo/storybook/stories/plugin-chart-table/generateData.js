/* eslint-disable no-unused-vars */
/* eslint-disable no-magic-numbers */
/* eslint-disable sort-keys */

const getHTML = () => {
  const randomText = Array(Math.floor(Math.random() * 20))
    .fill('very')
    .join(' ');

  return `<a href="www.google.com" target="_blank">Link Test with a ${randomText} long title</a>`;
};

export default function generateData(rowCount = 30, columnCount = 20) {
  const columns = Array(columnCount)
    .fill(0)
    .map((_, i) => `clm ${i}`);

  return Array(rowCount)
    .fill(0)
    .map((_, index) => ({
      index: index + 1,
      html: getHTML(),
      ...columns.reduce(
        (prev, key, i) => {
          const obj = prev;
          // eslint-disable-next-line no-restricted-properties
          obj[key] = Math.round(Math.random() * Math.pow(10, i));

          return obj;
        },
        {
          ds: '2019-09-09',
        },
      ),
    }));
}
