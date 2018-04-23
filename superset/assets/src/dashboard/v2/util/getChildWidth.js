export default function getTotalChildWidth({ id, components }) {
  const component = components[id];
  if (!component) return 0;

  let width = 0;

  (component.children || []).forEach((childId) => {
    const child = components[childId];
    width += child.meta.width || 0;
  });

  return width;
}
