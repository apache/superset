import MathArray from './math-array';
import {checkNumber} from '../../lib/validators';
import {config} from '../../lib/common';

export default class Matrix extends MathArray {
  // fromObject(object) {
  //   const array = object.elements;
  //   return this.fromRowMajor(array);
  // }

  // toObject(object) {
  //   const array = object.elements;
  //   this.toRowMajor(array);
  //   return object;
  // }

  toString() {
    let string = '[';
    if (config.printRowMajor) {
      string += 'row-major:';
      for (let row = 0; row < this.RANK; ++row) {
        for (let col = 0; col < this.RANK; ++col) {
          string += ` ${this[col * this.RANK + row]}`;
        }
      }
    } else {
      string += 'column-major:';
      for (let i = 0; i < this.ELEMENTS; ++i) {
        string += ` ${this[i]}`;
      }
    }
    string += ']';
    return string;
  }

  getElementIndex(row, col) {
    return col * this.RANK + row;
  }

  // By default assumes row major indices
  getElement(row, col) {
    return this[col * this.RANK + row];
  }

  // By default assumes row major indices
  setElement(row, col, value) {
    this[col * this.RANK + row] = checkNumber(value);
    return this;
  }

  getColumn(columnIndex, result = new Array(this.RANK).fill(-0)) {
    const firstIndex = columnIndex * this.RANK;
    for (let i = 0; i < this.RANK; ++i) {
      result[i] = this[firstIndex + i];
    }
    return result;
  }

  setColumn(columnIndex, columnVector) {
    const firstIndex = columnIndex * this.RANK;
    for (let i = 0; i < this.RANK; ++i) {
      this[firstIndex + i] = columnVector[i];
    }
    return this;
  }
}
