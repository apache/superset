export default function findParentId({ childId, components = {} }) {
  let parentId = null;

  const ids = Object.keys(components);
  for (let i = 0; i < ids.length - 1; i += 1) {
    const id = ids[i];
    const component = components[id] || {};
    if (id !== childId && component.children && component.children.includes(childId)) {
      parentId = id;
      break;
    }
  }

  return parentId;
}
