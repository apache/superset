export default function transformProps(basicChartInput) {
  const { height, formData, payload } = basicChartInput;
  const {
    maxBubbleSize,
    showBubbles,
  } = formData;

  return {
    data: payload.data,
    height,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
