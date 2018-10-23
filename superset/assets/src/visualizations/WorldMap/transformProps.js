export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { maxBubbleSize, showBubbles } = formData;

  return {
    data: payload.data,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
