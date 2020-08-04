export function pinchDistance(event) {
  const t = event.touches,
        dx = t[0].clientX - t[1].clientX,
        dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pinchAngle(event) {
  const t = event.touches;
  return Math.atan2(
    t[0].clientY - t[1].clientY,
    t[0].clientX - t[1].clientX
  );
}
