// Type definitions for decimal.js >=7.0.0
// Project: https://github.com/MikeMcl/decimal.js
// Definitions by: Michael Mclaughlin <https://github.com/MikeMcl>
// Definitions: https://github.com/MikeMcl/decimal.js
//
// Documentation: http://mikemcl.github.io/decimal.js/
//
// Exports (available globally or when using import):
//
//   class     Decimal (default export)
//   type      Decimal.Constructor
//   type      Decimal.Instance
//   type      Decimal.Modulo
//   type      Decimal.Rounding
//   type      Decimal.Value
//   interface Decimal.Config
//
// Example (alternative syntax commented-out):
//
//   import {Decimal} from "decimal.js"
//   //import Decimal from "decimal.js"
//
//   let r: Decimal.Rounding = Decimal.ROUND_UP;
//   let c: Decimal.Configuration = {precision: 4, rounding: r};
//   Decimal.set(c);
//   let v: Decimal.Value = '12345.6789';
//   let d: Decimal = new Decimal(v);
//   //let d: Decimal.Instance = new Decimal(v);
//
// The use of compiler option `--strictNullChecks` is recommended.

export default Decimal;

export namespace Decimal {
  export type Config = DecimalConfig;
  export type Constructor = DecimalConstructor;
  export type Instance = DecimalInstance;
  export type Modulo = DecimalModulo;
  export type Rounding = DecimalRounding;
  export type Value = DecimalValue;
}

declare global {
  const Decimal: DecimalConstructor;
  type Decimal = DecimalInstance;

  namespace Decimal {
    type Config = DecimalConfig;
    type Constructor = DecimalConstructor;
    type Instance = DecimalInstance;
    type Modulo = DecimalModulo;
    type Rounding = DecimalRounding;
    type Value = DecimalValue;
  }
}

type DecimalInstance = Decimal;
type DecimalConstructor = typeof Decimal;
type DecimalValue = string | number | Decimal;
type DecimalRounding = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type DecimalModulo = DecimalRounding | 9;

// http://mikemcl.github.io/decimal.js/#constructor-properties
interface DecimalConfig {
  precision?: number;
  rounding?: DecimalRounding;
  toExpNeg?: number;
  toExpPos?: number;
  minE?: number;
  maxE?: number;
  crypto?: boolean;
  modulo?: DecimalModulo;
  defaults?: boolean;
}

export declare class Decimal {
  readonly d: number[];
  readonly e: number;
  readonly s: number;
  private readonly name: string;

  constructor(n: DecimalValue);

  absoluteValue(): Decimal;
  abs(): Decimal;

  ceil(): Decimal;

  comparedTo(n: DecimalValue): number;
  cmp(n: DecimalValue): number;

  cosine(): Decimal;
  cos(): Decimal;

  cubeRoot(): Decimal;
  cbrt(): Decimal;

  decimalPlaces(): number;
  dp(): number;

  dividedBy(n: DecimalValue): Decimal;
  div(n: DecimalValue): Decimal;

  dividedToIntegerBy(n: DecimalValue): Decimal;
  divToInt(n: DecimalValue): Decimal;

  equals(n: DecimalValue): boolean;
  eq(n: DecimalValue): boolean;

  floor(): Decimal;

  greaterThan(n: DecimalValue): boolean;
  gt(n: DecimalValue): boolean;

  greaterThanOrEqualTo(n: DecimalValue): boolean;
  gte(n: DecimalValue): boolean;

  hyperbolicCosine(): Decimal;
  cosh(): Decimal;

  hyperbolicSine(): Decimal;
  sinh(): Decimal;

  hyperbolicTangent(): Decimal;
  tanh(): Decimal;

  inverseCosine(): Decimal;
  acos(): Decimal;

  inverseHyperbolicCosine(): Decimal;
  acosh(): Decimal;

  inverseHyperbolicSine(): Decimal;
  asinh(): Decimal;

  inverseHyperbolicTangent(): Decimal;
  atanh(): Decimal;

  inverseSine(): Decimal;
  asin(): Decimal;

  inverseTangent(): Decimal;
  atan(): Decimal;

  isFinite(): boolean;

  isInteger(): boolean;
  isInt(): boolean;

  isNaN(): boolean;

  isNegative(): boolean;
  isNeg(): boolean;

  isPositive(): boolean;
  isPos(): boolean;

  isZero(): boolean;

  lessThan(n: DecimalValue): boolean;
  lt(n: DecimalValue): boolean;

  lessThanOrEqualTo(n: DecimalValue): boolean;
  lte(n: DecimalValue): boolean;

  logarithm(n?: DecimalValue): Decimal;
  log(n?: DecimalValue): Decimal;

  minus(n: DecimalValue): Decimal;
  sub(n: DecimalValue): Decimal;

  modulo(n: DecimalValue): Decimal;
  mod(n: DecimalValue): Decimal;

  naturalExponential(): Decimal;
  exp(): Decimal;

  naturalLogarithm(): Decimal;
  ln(): Decimal;

  negated(): Decimal;
  neg(): Decimal;

  plus(n: DecimalValue): Decimal;
  add(n: DecimalValue): Decimal;

  precision(includeZeros?: boolean): number;
  sd(includeZeros?: boolean): number;

  round(): Decimal;

  sine() : Decimal;
  sin() : Decimal;

  squareRoot(): Decimal;
  sqrt(): Decimal;

  tangent() : Decimal;
  tan() : Decimal;

  times(n: DecimalValue): Decimal;
  mul(n: DecimalValue) : Decimal;

  toBinary(significantDigits?: number): string;
  toBinary(significantDigits: number, rounding: DecimalRounding): string;

  toDecimalPlaces(decimalPlaces?: number): Decimal;
  toDecimalPlaces(decimalPlaces: number, rounding: DecimalRounding): Decimal;
  toDP(decimalPlaces?: number): Decimal;
  toDP(decimalPlaces: number, rounding: DecimalRounding): Decimal;

  toExponential(decimalPlaces?: number): string;
  toExponential(decimalPlaces: number, rounding: DecimalRounding): string;

  toFixed(decimalPlaces?: number): string;
  toFixed(decimalPlaces: number, rounding: DecimalRounding): string;

  toFraction(max_denominator?: DecimalValue): Decimal[];

  toHexadecimal(significantDigits?: number): string;
  toHexadecimal(significantDigits: number, rounding: DecimalRounding): string;
  toHex(significantDigits?: number): string;
  toHex(significantDigits: number, rounding?: DecimalRounding): string;

  toJSON(): string;

  toNearest(n: DecimalValue, rounding?: DecimalRounding): Decimal;

  toNumber(): number;

  toOctal(significantDigits?: number): string;
  toOctal(significantDigits: number, rounding: DecimalRounding): string;

  toPower(n: DecimalValue): Decimal;
  pow(n: DecimalValue): Decimal;

  toPrecision(significantDigits?: number): string;
  toPrecision(significantDigits: number, rounding: DecimalRounding): string;

  toSignificantDigits(significantDigits?: number): Decimal;
  toSignificantDigits(significantDigits: number, rounding: DecimalRounding): Decimal;
  toSD(significantDigits?: number): Decimal;
  toSD(significantDigits: number, rounding: DecimalRounding): Decimal;

  toString(): string;

  truncated(): Decimal;
  trunc(): Decimal;

  valueOf(): string;

  static abs(n: DecimalValue): Decimal;
  static acos(n: DecimalValue): Decimal;
  static acosh(n: DecimalValue): Decimal;
  static add(x: DecimalValue, y: DecimalValue): Decimal;
  static asin(n: DecimalValue): Decimal;
  static asinh(n: DecimalValue): Decimal;
  static atan(n: DecimalValue): Decimal;
  static atanh(n: DecimalValue): Decimal;
  static atan2(y: DecimalValue, x: DecimalValue): Decimal;
  static cbrt(n: DecimalValue): Decimal;
  static ceil(n: DecimalValue): Decimal;
  static clone(object?: DecimalConfig): DecimalConstructor;
  static config(object: DecimalConfig): DecimalConstructor;
  static cos(n: DecimalValue): Decimal;
  static cosh(n: DecimalValue): Decimal;
  static div(x: DecimalValue, y: DecimalValue): Decimal;
  static exp(n: DecimalValue): Decimal;
  static floor(n: DecimalValue): Decimal;
  static hypot(...n: DecimalValue[]): Decimal;
  static isDecimal(object: any): boolean
  static ln(n: DecimalValue): Decimal;
  static log(n: DecimalValue, base?: DecimalValue): Decimal;
  static log2(n: DecimalValue): Decimal;
  static log10(n: DecimalValue): Decimal;
  static max(...n: DecimalValue[]): Decimal;
  static min(...n: DecimalValue[]): Decimal;
  static mod(x: DecimalValue, y: DecimalValue): Decimal;
  static mul(x: DecimalValue, y: DecimalValue): Decimal;
  static noConflict(): DecimalConstructor;   // Browser only
  static pow(base: DecimalValue, exponent: DecimalValue): Decimal;
  static random(significantDigits?: number): Decimal;
  static round(n: DecimalValue): Decimal;
  static set(object: DecimalConfig): DecimalConstructor;
  static sign(n: DecimalValue): Decimal;
  static sin(n: DecimalValue): Decimal;
  static sinh(n: DecimalValue): Decimal;
  static sqrt(n: DecimalValue): Decimal;
  static sub(x: DecimalValue, y: DecimalValue): Decimal;
  static tan(n: DecimalValue): Decimal;
  static tanh(n: DecimalValue): Decimal;
  static trunc(n: DecimalValue): Decimal;

  static readonly default?: DecimalConstructor;
  static readonly Decimal?: DecimalConstructor;

  static readonly precision: number;
  static readonly rounding: DecimalRounding;
  static readonly toExpNeg: number;
  static readonly toExpPos: number;
  static readonly minE: number;
  static readonly maxE: number;
  static readonly crypto: boolean;
  static readonly modulo: DecimalModulo;

  static readonly ROUND_UP: 0;
  static readonly ROUND_DOWN: 1;
  static readonly ROUND_CEIL: 2;
  static readonly ROUND_FLOOR: 3;
  static readonly ROUND_HALF_UP: 4;
  static readonly ROUND_HALF_DOWN: 5;
  static readonly ROUND_HALF_EVEN: 6;
  static readonly ROUND_HALF_CEIL: 7;
  static readonly ROUND_HALF_FLOOR: 8;
  static readonly EUCLID: 9;
}
