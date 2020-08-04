import { max } from 'd3-array'

// export function minEdgeDx (w, y0, y1) {
//   console.log('mindx', w, y0, y1)
//   const dy = y1 - y0
//   const ay = Math.abs(dy) - w  // final sign doesn't matter
//   const dx2 = w * w - ay * ay
//   const dx = dx2 >= 0 ? Math.sqrt(dx2) : w
//   return dx
// }

export default function positionHorizontally (G, width, nodeWidth) {
  // const minWidths = new Array(maxRank).fill(0)
  // G.edges().forEach(e => {
  //   const r0 = G.node(e.v).rank || 0
  //   minWidths[r0] = Math.max(minWidths[r0], minEdgeDx(G.edge(e).dy, G.node(e.v).y, G.node(e.w).y))
  // })
  // for (let i = 0; i < nested.length - 1; ++i) {
  //   minWidths[i] = 0
  //   nested[i].forEach(band => {
  //     band.forEach(d => {
  //       // edges for dummy nodes, outgoing for real nodes
  //       (d.outgoing || d.edges).forEach(e => {
  //         minWidths[i] = Math.max(minWidths[i], minEdgeDx(e))
  //       })
  //     })
  //   })
  // }
  // const totalMinWidth = sum(minWidths)
  // let dx
  // if (totalMinWidth > width) {
  //   // allocate fairly
  //   dx = minWidths.map(w => width * w / totalMinWidth)
  // } else {
  //   const spare = (width - totalMinWidth) / (nested.length - 1)
  //   dx = minWidths.map(w => w + spare)
  // }

  const maxRank = max(G.nodes(), u => G.node(u).rank || 0) || 0
  const dx = (width - nodeWidth) / maxRank

  G.nodes().forEach(u => {
    const node = G.node(u)
    node.x0 = dx * (node.rank || 0)
    node.x1 = node.x0 + nodeWidth
  })
}
