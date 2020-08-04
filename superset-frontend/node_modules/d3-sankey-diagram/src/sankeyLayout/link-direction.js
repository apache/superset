export default function linkDirection (G, e, head = true) {
  if (e.v === e.w) {
    // pretend self-links go downwards
    return Math.PI / 2 * (head ? +1 : -1)
  } else {
    // const source = G.node(e.v)
    // const target = G.node(e.w)
    // return Math.atan2(target.y - source.y,
    //                   target.x0 - source.x1)
    const link = G.edge(e)
    return Math.atan2(link.y1 - link.y0,
                      link.x1 - link.x0)
  }
}
