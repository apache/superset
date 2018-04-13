import { it, describe } from 'mocha';
import { expect } from 'chai';
import { isTruthy } from '../../../javascripts/utils/common';

describe('utils/common', () => {
  describe('isTruthy', () => {
    it('evals false-looking strings properly', () => {
      expect(isTruthy('f')).to.equal(false);
      expect(isTruthy('false')).to.equal(false);
      expect(isTruthy('no')).to.equal(false);
      expect(isTruthy('n')).to.equal(false);
      expect(isTruthy('F')).to.equal(false);
      expect(isTruthy('False')).to.equal(false);
      expect(isTruthy('NO')).to.equal(false);
      expect(isTruthy('N')).to.equal(false);
    });
    it('evals true-looking strings properly', () => {
      expect(isTruthy('t')).to.equal(true);
      expect(isTruthy('true')).to.equal(true);
      expect(isTruthy('yes')).to.equal(true);
      expect(isTruthy('y')).to.equal(true);
      expect(isTruthy('Y')).to.equal(true);
      expect(isTruthy('True')).to.equal(true);
      expect(isTruthy('Yes')).to.equal(true);
      expect(isTruthy('YES')).to.equal(true);
    });
    it('evals bools properly', () => {
      expect(isTruthy(false)).to.equal(false);
      expect(isTruthy(true)).to.equal(true);
    });
    it('evals ints properly', () => {
      expect(isTruthy(0)).to.equal(false);
      expect(isTruthy(1)).to.equal(true);
    });
    it('evals constants properly', () => {
      expect(isTruthy(null)).to.equal(false);
      expect(isTruthy(undefined)).to.equal(false);
    });
    it('string auto is false', () => {
      expect(isTruthy('false')).to.equal(false);
    });
  });
});
