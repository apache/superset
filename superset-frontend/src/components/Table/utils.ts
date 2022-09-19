/**
 * Method to check if a number is within inclusive range between a maximum vaues minus a threshold
 * Invalid non numeric inputs will not error, but will return false
 *
 * @param value number coordinate to determine if it is within bounds of the targetCoordinate - threshold.  Must be positive and less than maximum.
 * @param maximum number max value for the test range.  Must be positive and greater than value
 * @param threshold number values to determine a range from maximum - threshold.  Must be positive and greater than zero.
 * @returns
 */
export const withinRange = (
  value: number,
  maximum: number,
  threshold: number,
) => {
  let within = false;
  const diff = maximum - value;
  if (diff > 0 && diff <= threshold) {
    within = true;
  }
  return within;
};
