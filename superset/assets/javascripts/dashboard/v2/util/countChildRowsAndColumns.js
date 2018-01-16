export default function countChildRowsAndColumns({ component, components }) {
  let columnCount = 0;
  let rowCount = 0;

  (component.children || []).forEach((childId) => {
    const childComponent = components[childId];
    columnCount += (childComponent.meta || {}).width || 0;
    if ((childComponent.meta || {}).height) {
      rowCount = Math.max(rowCount, childComponent.meta.height);
    }
  });

  return { columnCount, rowCount };
}
