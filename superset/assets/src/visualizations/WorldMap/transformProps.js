export default function transformProps({ slice, payload }) {
  const { formData } = slice;
  const {
    max_bubble_size: maxBubbleSize,
    show_bubbles: showBubbles,
  } = formData;

  return {
    data: payload.data,
    height: slice.height(),
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
  };
}
