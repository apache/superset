export default function transformProps(chartProps) {
  const { height, formData, payload } = chartProps;
  const { maxBubbleSize, showBubbles } = formData;

  return {
    height,
    data: payload.data,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
