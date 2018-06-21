function findParentId({ childId, layout = {} }) {
  let parentId = null;

  const ids = Object.keys(layout);
  for (let i = 0; i <= ids.length - 1; i += 1) {
    const id = ids[i];
    const component = layout[id] || {};
    if (
      id !== childId &&
      component.children &&
      component.children.includes(childId)
    ) {
      parentId = id;
      break;
    }
  }

  return parentId;
}

const cache = {};
export default function findParentIdWithCache({ childId, layout = {} }) {
  if (cache[childId]) {
    const lastParent = layout[cache[childId]] || {};
    if (lastParent.children && lastParent.children.includes(childId)) {
      return lastParent.id;
    }
  }
  cache[childId] = findParentId({ childId, layout });
  return cache[childId];
}
