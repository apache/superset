export const convertInteger = (value: string | number) => {
  if (typeof value !== 'number') return parseInt(value, 10) || 0;
  return value;
};
