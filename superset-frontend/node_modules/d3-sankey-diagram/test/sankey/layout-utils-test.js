import { findFirst, sweepCurvatureInwards } from '../../src/sankeyLayout/utils.js'
import tape from 'tape'

tape('sankeyLayout: findFirst() returns first link satisfying test', test => {
  const links = [
    {y0: 0, y1: -10},
    {y0: 1, y1: 0},
    {y0: 2, y1: 10}
  ]
  test.equal(findFirst(links, f => f.y1 > f.y0), 2)
  test.end()
})

tape('sankeyLayout: sweepCurvatureInwards() increases radius outside to avoid overlap', test => {
  const links = [
    { Rmax: 100, dy: 6, r0: 42 },
    { Rmax: 100, dy: 6, r0: 40 }
  ]
  sweepCurvatureInwards(links, 'r0')
  test.deepEqual(links.map(f => f.r0), [46, 40])
  test.end()
})

tape('sankeyLayout: sweepCurvatureInwards() reduces radius inside to satisfy Rmax', test => {
  const links = [
    { Rmax: 42, dy: 6, r0: 42 },
    { Rmax: 100, dy: 6, r0: 40 }
  ]
  sweepCurvatureInwards(links, 'r0')
  test.deepEqual(links.map(f => f.r0), [42, 36])
  test.end()
})

tape('sankeyLayout: sweepCurvatureInwards() limits minimum inner radius', test => {
  const links = [
    { Rmax: 8, dy: 6, r0: 4 },
    { Rmax: 100, dy: 6, r0: 3 }
  ]
  sweepCurvatureInwards(links, 'r0')
  test.deepEqual(links.map(f => f.r0), [8, 3])
  test.end()
})
