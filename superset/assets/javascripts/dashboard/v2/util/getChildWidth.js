export default function getTotalChildWidth({ id, components, recurse = false }) {
  const component = components[id];
  if (!component) return 0;

  let width = 0;

  (component.children || []).forEach((childId) => {
    const child = components[childId];
    width = Math.max(width, child.meta.width);
    if (recurse) {
      width = Math.max(width, getTotalChildWidth(child, components));
    }
  });

  return width;
}
