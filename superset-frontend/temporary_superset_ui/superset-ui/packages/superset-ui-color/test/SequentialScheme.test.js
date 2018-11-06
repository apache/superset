import SequentialScheme from '../src/SequentialScheme';

describe('SequentialScheme', () => {
  const scheme = new SequentialScheme({
    name: 'white to black',
    colors: ['#fff', '#000'],
  });
  it('exists', () => {
    expect(SequentialScheme).toBeDefined();
  });
  describe('new SequentialScheme()', () => {
    it('creates new instance', () => {
      const scheme2 = new SequentialScheme({
        name: 'white to black',
        colors: ['#fff', '#000'],
      });
      expect(scheme2).toBeInstanceOf(SequentialScheme);
    });
  });
  describe('.createLinearScale(extent)', () => {
    it('returns a linear scale for the given extent', () => {
      const scale = scheme.createLinearScale([10, 100]);
      expect(scale(1)).toEqual('rgb(255, 255, 255)');
      expect(scale(10)).toEqual('rgb(255, 255, 255)');
      expect(scale(55)).toEqual('rgb(128, 128, 128)');
      expect(scale(100)).toEqual('rgb(0, 0, 0)');
      expect(scale(1000)).toEqual('rgb(0, 0, 0)');
    });
    it('uses [0, 1] as extent if not specified', () => {
      const scale = scheme.createLinearScale();
      expect(scale(-1)).toEqual('rgb(255, 255, 255)');
      expect(scale(0)).toEqual('rgb(255, 255, 255)');
      expect(scale(0.5)).toEqual('rgb(128, 128, 128)');
      expect(scale(1)).toEqual('rgb(0, 0, 0)');
      expect(scale(2)).toEqual('rgb(0, 0, 0)');
    });
  });
  describe('.getColors(numColors)', () => {
    it('returns the original colors if numColors is not specified', () => {
      expect(scheme.getColors()).toEqual(['#fff', '#000']);
    });
    it('returns the exact number of colors if numColors is specified', () => {
      expect(scheme.getColors(2)).toEqual(['#fff', '#000']);
      expect(scheme.getColors(3)).toEqual([
        'rgb(255, 255, 255)',
        'rgb(128, 128, 128)',
        'rgb(0, 0, 0)',
      ]);
      expect(scheme.getColors(4)).toEqual([
        'rgb(255, 255, 255)',
        'rgb(170, 170, 170)',
        'rgb(85, 85, 85)',
        'rgb(0, 0, 0)',
      ]);
    });
  });
});
