import Bounds from './Bounds';

export default function Item(mark) {
  this.mark = mark;
  this.bounds = (this.bounds || new Bounds());
}
