export const convertNumber = (value: string | number) => {
  /* eslint radix: ["error", "as-needed"] */
  if (typeof value !== 'number') return parseInt(value) || 0;
  return value;
};
