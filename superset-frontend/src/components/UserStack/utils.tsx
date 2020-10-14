// https://en.wikipedia.org/wiki/Linear_congruential_generator
function stringAsciiPRNG(value: string, m: number) {
  // Xn+1 = (a * Xn + c) % m
  // 0 < a < m
  // 0 <= c < m
  // 0 <= X0 < m

  const charCodes = [...value].map(letter => letter.charCodeAt(0));
  const len = charCodes.length;

  const a = (len % (m - 1)) + 1;
  const c = charCodes.reduce((current, next) => current + next) % m;

  let random = charCodes[0] % m;

  [...new Array(len)].forEach(() => {
    random = (a * random + c) % m;
  });

  return random;
}

export function getRandomColor(sampleValue: string, colorList: string[]) {
  // if no value is passed, always return transparent color for consistency
  if (!sampleValue) return 'transparent';

  // value based random color index,
  // ensuring the same sampleValue always resolves to the same color
  return colorList[stringAsciiPRNG(sampleValue, colorList.length)];
}
