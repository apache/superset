// Ordinary Least Squares
export default function(uX, uY, uXY, uX2) {
  const delta = uX2 - uX * uX,
        slope = Math.abs(delta) < 1e-24 ? 0 : (uXY - uX * uY) / delta,
        intercept = uY - slope * uX;

  return [intercept, slope];
}
