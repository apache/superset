import LazyFactory from '@superset-ui/core/src/dimension/svg/LazyFactory';

describe('LazyFactory', () => {
  describe('createInContainer()', () => {
    it('creates node in the specified container', () => {
      const factory = new LazyFactory(() => document.createElement('div'));
      const div = factory.createInContainer();
      const innerDiv = factory.createInContainer(div);
      expect(div.parentNode).toEqual(document.body);
      expect(innerDiv.parentNode).toEqual(div);
    });
    it('reuses existing', () => {
      const factoryFn = jest.fn(() => document.createElement('div'));
      const factory = new LazyFactory(factoryFn);
      const div1 = factory.createInContainer();
      const div2 = factory.createInContainer();
      expect(div1).toBe(div2);
      expect(factoryFn).toHaveBeenCalledTimes(1);
    });
  });
  describe('removeFromContainer', () => {
    it('removes node from container', () => {
      const factory = new LazyFactory(() => document.createElement('div'));
      const div = factory.createInContainer();
      const innerDiv = factory.createInContainer(div);
      expect(div.parentNode).toEqual(document.body);
      expect(innerDiv.parentNode).toEqual(div);
      factory.removeFromContainer();
      factory.removeFromContainer(div);
      expect(div.parentNode).toBeNull();
      expect(innerDiv.parentNode).toBeNull();
    });
    it('does not remove if others are using', () => {
      const factory = new LazyFactory(() => document.createElement('div'));
      const div1 = factory.createInContainer();
      factory.createInContainer();
      factory.removeFromContainer();
      expect(div1.parentNode).toEqual(document.body);
      factory.removeFromContainer();
      expect(div1.parentNode).toBeNull();
    });
    it('does not crash if try to remove already removed node', () => {
      const factory = new LazyFactory(() => document.createElement('div'));
      factory.createInContainer();
      factory.removeFromContainer();
      expect(() => factory.removeFromContainer()).not.toThrow();
    });
  });
});
