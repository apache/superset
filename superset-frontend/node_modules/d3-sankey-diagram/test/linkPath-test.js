import sankeyLink from '../src/linkPath.js'
import tape from 'tape'
import compareSVGPath from './compareSVGPath.js'

// tape('sankeyLink() has the expected defaults', test => {
//   var link = sankeyLink()
//   test.equal(link.segments()({segments: 'foo'}), 'foo')
//   test.end()
// })

// tape('sankeyLink.segments(s) tests that s is a function', test => {
//   var link = sankeyLink()
//   test.throws(function () { link.segments(42) })
//   test.throws(function () { link.segments(null) })
//   test.end()
// })

tape('sankeyLink() path curves downwards with different radii', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 10},
      {x: 30, y: 70, ri: 20}
    ],
    dy: 2
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A11 11 1.571 0 1 11,10 ' +
                 'L11,50 ' +
                 'A19 19 1.571 0 0 30,69 ' +
                 'L30,71 ' +
                 'A21 21 1.571 0 1 9,50 ' +
                 'L9,10 ' +
                 'A9 9 1.571 0 0 0,1 ' +
                 'Z')
  test.end()
})

tape('sankeyLink() path curves upwards with different radii', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 10},
      {x: 30, y: -70, ri: 20}
    ],
    dy: 2
  }

  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A9 9 1.571 0 0 9,-10 ' +
                 'L9,-50 ' +
                 'A21 21 1.571 0 1 30,-71 ' +
                 'L30,-69 ' +
                 'A19 19 1.571 0 0 11,-50 ' +
                 'L11,-10 ' +
                 'A11 11 1.571 0 1 0,1 ' +
                 'Z')
  test.end()
})

tape('sankeyLink() default link shape has two adjacent circular arcs', test => {
  const link = {
    points: [
      {x: 0, y: 0},
      {x: 15, y: 10}
    ],
    dy: 2
  }

  // radius = 5
  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A6 6 0.729 0 1 4,0.527 ' +
                 'L12.333,7.981 ' +
                 'A4 4 0.729 0 0 15,9 ' +
                 'L15,11 ' +
                 'A6 6 0.729 0 1 11,9.472 ' +
                 'L2.666,2.018 ' +
                 'A4 4 0.729 0 0 0,1 ' +
                 'Z')
  test.end()
})

tape('sankeyLink() reduces to straight line', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 1},
      {x: 10, y: 0, ri: 1}
    ],
    dy: 2
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A0 0 0 0 0 0,-1 ' +
                 'L10,-1 ' +
                 'A0 0 0 0 0 10,-1 ' +
                 'L10,1 ' +
                 'A0 0 0 0 0 10,1 ' +
                 'L0,1 ' +
                 'A0 0 0 0 0 0,1 ' +
                 'Z')
  test.end()
})

// XXX check this with r0, r1
tape('sankeyLink() specifying link radius', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 1},
      {x: 2, y: 10, ri: 1}
    ],
    dy: 2
  }

  // radius = 1, angle = 90
  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A2 2 1.570 0 1 2,0.999 ' +
                 'L2,9 ' +
                 'A0 0 1.570 0 0 2,9 ' +
                 'L2,11 ' +
                 'A2 2 1.570 0 1 0,9 ' +
                 'L0,1 ' +
                 'A0 0 1.570 0 0 0,1 ' +
                 'Z')
  test.end()
})

tape('sankeyLink() minimum thickness when dy small', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 1},
      {x: 2, y: 10, ri: 1}
    ],
    dy: 2
  }

  const path1 = sankeyLink()(link)
  link.dy = 0.01
  const path2 = sankeyLink()(link)

  compareSVGPath(test, path1, path2)
  test.end()
})

tape('sankeyLink() thickness goes to zero when dy = 0', test => {
  const link = {
    points: [
      {x: 0, y: 0, ro: 1},
      {x: 10, y: 0, ri: 1}
    ],
    dy: 0
  }

  compareSVGPath(test, sankeyLink()(link),
                 'M0,0 ' +
                 'A0 0 0 0 0 0,0 ' +
                 'L10,0 ' +
                 'A0 0 0 0 0 10,0 ' +
                 'L10,0 ' +
                 'A0 0 0 0 0 10,0 ' +
                 'L0,0 ' +
                 'A0 0 0 0 0 0,0 ' +
                 'Z')
  test.end()
})

// tape('sankeyLink() self-loops are drawn below with default radius 1.5x width', test => {
//   let link = sankeyLink(),
//       node = {},
//       segment = {
//         x0: 0,
//         x1: 0,
//         y0: 0,
//         y1: 0,
//         dy: 10,
//         source: node,
//         target: node,
//       };

//   // Arc: A rx ry theta large-arc-flag direction-flag x y
//   compareSVGPath(test, link(segment),
//                  'M0.1,-5 ' +
//                  'A12.5 12.5 6.283 1 1 -0.1,-5 ' +
//                  'L-0.1,5 ' +
//                  'A2.5 2.5 6.283 1 0 0.1,5 ' +
//                  'Z');

//   test.end();
// });

tape('sankeyLink() flow from forward to reverse node', test => {
  const link = {
    points: [
      {x: 0, y: 0, d: 'r'},
      {x: 0, y: 50, d: 'l'}
    ],
    dy: 10
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-5 ' +
                 'A15 15 1.570 0 1 15,10 ' +
                 'L15,40 ' +
                 'A15 15 1.570 0 1 0,55 ' +
                 'L0,45 ' +
                 'A5 5 1.570 0 0 5,40 ' +
                 'L5,10 ' +
                 'A5 5 1.570 0 0 0,5 ' +
                 'Z')

  // force radius
  link.points[0].ro = link.points[1].ri = 20
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-5 ' +
                 'A25 25 1.570 0 1 25,20 ' +
                 'L25,30 ' +
                 'A25 25 1.570 0 1 0,55 ' +
                 'L0,45 ' +
                 'A15 15 1.570 0 0 15,30 ' +
                 'L15,20 ' +
                 'A15 15 1.570 0 0 0,5 ' +
                 'Z')

  test.end()
})

tape('sankeyLink() flow from reverse to forward node', test => {
  const link = {
    points: [
      {x: 0, y: 0, d: 'l'},
      {x: 0, y: 50, d: 'r'}
    ],
    dy: 10
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-5 ' +
                 'A15 15 1.570 0 0 -15,10 ' +
                 'L-15,40 ' +
                 'A15 15 1.570 0 0 0,55 ' +
                 'L0,45 ' +
                 'A5 5 1.570 0 1 -5,40 ' +
                 'L-5,10 ' +
                 'A5 5 1.570 0 1 0,5 ' +
                 'Z')
  test.end()
})

tape('sankeyLink() flow from reverse to reverse node', test => {
  const link = {
    points: [
      {x: 20, y: 0, d: 'l'},
      {x: 0, y: 0, d: 'l'}
    ],
    dy: 10
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-5 ' +
                 'A0 0 0 0 0 0,-5 ' +
                 'L20,-5 ' +
                 'A0 0 0 0 0 20,-5 ' +
                 'L20,5 ' +
                 'A0 0 0 0 0 20,5 ' +
                 'L0,5 ' +
                 'A0 0 0 0 0 0,5 ' +
                 'Z')
  test.end()
})

// tape('sankeyLink() flow from forward to offstage node', test => {
//   let segment = {
//     x0: 0,
//     y0: 5,
//     x1: 10,
//     y1: 30,
//     dy: 10,
//     d0: 'r',
//     d1: 'd'
//   }

//   // Arc: A rx ry theta large-arc-flag direction-flag x y
//   compareSVGPath(test, sankeyLink()(segment),
//                  'M0,0 ' +
//                  'A15 15 1.570 0 1 15,15 ' +
//                  'L15,30 5,30 5,15 ' +
//                  'A5 5 1.570 0 0 0,10 ' +
//                  'Z')
//   test.end()
// })

tape('sankeyLink() with multiple segments', test => {
  const link = {
    points: [
      {x: 0, y: 0},
      {x: 10, y: 0},
      {x: 20, y: 0}
    ],
    dy: 2
  }

  // Arc: A rx ry theta large-arc-flag direction-flag x y
  compareSVGPath(test, sankeyLink()(link),
                 'M0,-1 ' +
                 'A0 0 0 0 0 0,-1 ' +
                 'L10,-1 ' +
                 'A0 0 0 0 0 10,-1 ' +
                 'L10,1 ' +
                 'A0 0 0 0 0 10,1 ' +
                 'L0,1 ' +
                 'A0 0 0 0 0 0,1 ' +
                 'Z' +
                 'M10,-1 ' +
                 'A0 0 0 0 0 10,-1 ' +
                 'L20,-1 ' +
                 'A0 0 0 0 0 20,-1 ' +
                 'L20,1 ' +
                 'A0 0 0 0 0 20,1 ' +
                 'L10,1 ' +
                 'A0 0 0 0 0 10,1 ' +
                 'Z')
  test.end()
})
