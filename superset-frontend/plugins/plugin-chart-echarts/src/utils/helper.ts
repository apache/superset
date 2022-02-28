export const convertNumber = (value: string | number) => {
  if (typeof value !== "number")
    return parseInt(value) || 0;
  else return value;
};
