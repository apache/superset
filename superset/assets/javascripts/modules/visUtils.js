export function getTextWidth(text, fontDetails = '12px Roboto') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    // Won't work outside of a browser context (ie unit tests)
    context.font = fontDetails;
    return context.measureText(text).width;
  }
  return 100;
}

export default {
  getTextWidth,
};
