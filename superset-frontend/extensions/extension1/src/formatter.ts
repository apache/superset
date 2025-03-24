export const formatter = (value: string | number): string => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value;
};
