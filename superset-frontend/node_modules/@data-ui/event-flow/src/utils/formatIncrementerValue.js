const lookup = {
  5: '5th',
  4: '4th',
  3: '3rd',
  2: '2nd',
  1: '1st',
  '-1': 'last',
  '-2': '2nd to last',
  '-3': '3rd to last',
  '-4': '4th to last',
  '-5': '5th to last',
};

export default function formatIncrementerValue(val) {
  return lookup[val] || val;
}
