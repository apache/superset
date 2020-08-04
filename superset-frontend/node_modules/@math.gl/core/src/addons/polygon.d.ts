type SegmentVisitor = (p1: number[], p2: number, i1: number, i2: number) => void;

export default class Polygon {
  constructor(points: number[][]);

  // https://en.wikipedia.org/wiki/Shoelace_formula
  getSignedArea(): number;
  getArea(): number;
  getWindingDirection(): number;
  forEachSegment(visitor: SegmentVisitor);
}
