import { computeMaxFontSize } from '../src/index';
import { addDummyFill, removeDummyFill } from './getBBoxDummyFill';

describe('computeMaxFontSize(input)', () => {
  describe('returns dimension of the given text', () => {
    beforeEach(addDummyFill);
    afterEach(removeDummyFill);

    it('requires either idealFontSize or maxHeight', () => {
      expect(() =>
        computeMaxFontSize({
          text: 'sample text',
        }),
      ).toThrowError();
    });
    it('computes maximum font size for given maxWidth and maxHeight', () => {
      expect(
        computeMaxFontSize({
          maxWidth: 400,
          maxHeight: 30,
          text: 'sample text',
        }),
      ).toEqual(30);
    });
    it('computes maximum font size for given idealFontSize and maxHeight', () => {
      expect(
        computeMaxFontSize({
          maxHeight: 20,
          idealFontSize: 40,
          text: 'sample text',
        }),
      ).toEqual(20);
    });
    it('computes maximum font size for given maxWidth and idealFontSize', () => {
      expect(
        computeMaxFontSize({
          maxWidth: 250,
          idealFontSize: 40,
          text: 'sample text',
        }),
      ).toEqual(25);
    });
  });
});
