export default function positionGroup (nodes, group) {
  const rect = {
    top: Number.MAX_VALUE,
    left: Number.MAX_VALUE,
    bottom: 0,
    right: 0
  }

  group.nodes.forEach(n => {
    const node = nodes.get(n)
    if (!node) return
    if (node.x0 < rect.left) rect.left = node.x0
    if (node.x1 > rect.right) rect.right = node.x1
    if (node.y0 < rect.top) rect.top = node.y0
    if (node.y1 > rect.bottom) rect.bottom = node.y1
  })

  group.rect = rect
  return group
}
