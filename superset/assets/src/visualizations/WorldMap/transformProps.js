export default function transformProps(basicChartInput) {
  const { height, formData, payload } = basicChartInput;
  const {
    max_bubble_size: maxBubbleSize,
    show_bubbles: showBubbles,
  } = formData;

  return {
    data: payload.data,
    height,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
