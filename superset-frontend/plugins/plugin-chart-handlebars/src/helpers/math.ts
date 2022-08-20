/**
 * A sum helper calculating the sum of two numbers.
 *
 * @example
 *      {{sum 1 2}}     => 3
 *
 * @param {number} value1
 * @param {number} value2
 * @returns {number}
 */
export function sum(value1: number, value2: number) {
  return Number(value1) + Number(value2);
}

/**
 * A difference helper calculating the difference of two numbers.
 *
 * @example
 *      {{difference 5 2}}  => 3
 *
 * @param {number} value1
 * @param {number} value2
 * @returns {number}
 */
export function difference(value1: number, value2: number) {
  return Number(value1) - Number(value2);
}

/**
 * A multiplication helper calculating the multiplication of two numbers.
 *
 * @example
 *      {{multiplication 5 2}}  => 10
 *
 * @param {number} value1
 * @param {number} value2
 * @returns {number}
 */
export function multiplication(value1: number, value2: number) {
  return Number(value1) * Number(value2);
}

/**
 * A division helper calculating the division of two numbers.
 *
 * @example
 *      {{division 5 2}}  => 2.5
 *
 * @param {number} value1
 * @param {number} value2
 * @returns {number}
 */
export function division(value1: number, value2: number) {
  return Number(value1) / Number(value2);
}

/**
 * A remainder helper calculating the remainder of two numbers.
 *
 * @example
 *      {{remainder 5 2}}  => 1
 *
 * @param {number} value1
 * @param {number} value2
 * @returns {number}
 */
export function remainder(value1: number, value2: number) {
  return Number(value1) % Number(value2);
}

/**
 * A ceil helper to find the ceil value of the number.
 *
 * @example
 *      {{ceil 5.6}}    => 6
 *
 * @param {number} value
 * @returns {number}
 */
export function ceil(value: number) {
  return Math.ceil(Number(value));
}

/**
 * A floor helper to find the floor value of the number.
 *
 * @example
 *      {{floor 5.6}} => 5
 *
 * @param {number} value
 * @returns {number}
 */
export function floor(value: number) {
  return Math.floor(Number(value));
}

/**
 * An abs helper to find the absolute value of the number.
 *
 * @example
 *      {{abs -5.6}} => 5.6
 *
 * @param {number} value
 * @returns {number}
 */
export function abs(value: number) {
  return Math.abs(Number(value));
}
