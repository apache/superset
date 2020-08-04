export interface Changeset {
  insert(tuples: any): this;
  remove(tuples: any): this;
  modify(tuple: any, field?: string, value?: any): this;
}

export function changeset(): Changeset;

export class Operator {
  constructor(init?: any, update?: (obj: any, pulse: any) => any, params?: any, react?: boolean);
  targets(): any;
  set(value: any): 1 | 0;
  skip(): (state: any) => any;
  modified(): (state: any) => any;
  parameters(params: object, react?: boolean, initonly?: boolean): Operator[];
  marshall(stamp: number): any;
  evaluate(pulse: any): any;
  run(pulse: any): any;
}

export class Transform extends Operator {
  constructor(init?: any, params?: any);
  transform(pulse: any, params?: any): any;
}

export function isTuple(t: any): boolean;
export function tupleid(t: any): number;
export function ingest(datum: any): any;
