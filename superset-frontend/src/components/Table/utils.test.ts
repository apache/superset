import { withinRange } from './utils';

test('withinRange', () => {
  // Valid inputs within range
  expect(withinRange(50, 60, 16)).toBeTruthy();

  // Valid inputs outside of range
  expect(withinRange(40, 60, 16)).toBeFalsy();

  // Invalid inputs should return falsy and not throw an error

  // Negative numbers not supported
  expect(withinRange(65, 60, -16)).toBeFalsy();
  expect(withinRange(-60, -65, 16)).toBeFalsy();
  expect(withinRange(-60, -65, 16)).toBeFalsy();
  expect(withinRange(-60, 65, 16)).toBeFalsy();

  // Invalid input types
  expect(withinRange(null, 60, undefined)).toBeFalsy();
  expect(withinRange([], 'hello', {})).toBeFalsy();
  expect(withinRange([], undefined, {})).toBeFalsy();
  expect(withinRange([], 'hello', {})).toBeFalsy();
});
