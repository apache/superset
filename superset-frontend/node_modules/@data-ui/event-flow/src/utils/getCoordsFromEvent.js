// from @vx/brush
export default function getCoordsFromEvent(node, event) {
  if (!node) return null;
  const svg = node.ownerSVGElement || node;
  if (svg.createSVGPoint) {
    let point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    point = point.matrixTransform(node.getScreenCTM().inverse());

    return {
      x: point.x,
      y: point.y,
    };
  }
  const rect = node.getBoundingClientRect();

  return {
    x: event.clientX - rect.left - node.clientLeft,
    y: event.clientY - rect.top - node.clientTop,
  };
}
