export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const { maxBubbleSize, showBubbles } = formData;

  return {
    data: payload.data,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
