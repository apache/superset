import MathArray from './math-array';

export default class Matrix<MatrixType> extends MathArray<MatrixType> {
  toString(): string;

  getElementIndex(row: number, col: number): number;
  // By default assumes row major indices
  getElement(row: number, col: number);
  // By default assumes row major indices
  setElement(row: number, col: number, value: number);
  getColumn(columnIndex: number, result?: number[]);
  setColumn(columnIndex: number, columnVector: number[]);
}
