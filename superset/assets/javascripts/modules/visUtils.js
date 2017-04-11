export function getTextWidth(text, fontDetails = '12px Roboto') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontDetails;
  const metrics = context.measureText(text);
  return metrics.width;
}

export default {
  getTextWidth,
};
