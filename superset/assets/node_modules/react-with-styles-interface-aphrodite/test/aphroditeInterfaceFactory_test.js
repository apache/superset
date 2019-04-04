import { expect } from 'chai';
import * as aphrodite from 'aphrodite';
import aphroditeInterfaceFactory from '../src/aphroditeInterfaceFactory';

describe('aphroditeInterfaceFactory', () => {
  const { StyleSheetTestUtils } = aphrodite;
  const aphroditeInterface = aphroditeInterfaceFactory(aphrodite);

  beforeEach(() => {
    StyleSheetTestUtils.suppressStyleInjection();
  });

  afterEach(() => {
    StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
  });

  describe('.create()', () => {
    it('processes the styles with Aphrodite', () => {
      expect(aphroditeInterface.create({
        foo: {
          color: 'red',
        },
      })).to.eql({
        foo: {
          _definition: {
            color: 'red',
          },
          _name: 'foo_im3wl1',
        },
      });
    });
  });

  describe('.resolve()', () => {
    it('turns a processed style into a className', () => {
      const styles = aphroditeInterface.create({
        foo: {
          color: 'red',
        },
      });

      expect(aphroditeInterface.resolve([styles.foo]))
        .to.eql({ className: 'foo_im3wl1' });
    });

    it('turns multiple processed styles into a className', () => {
      const styles = aphroditeInterface.create({
        foo: {
          color: 'red',
        },

        bar: {
          display: 'inline-block',
        },
      });

      expect(aphroditeInterface.resolve([styles.foo, styles.bar]))
        .to.eql({ className: 'foo_im3wl1-o_O-bar_cm9r68' });
    });

    it('handles an object with inline styles', () => {
      const style = {
        color: 'red',
      };

      expect(aphroditeInterface.resolve([style]))
        .to.eql({
          style: {
            color: 'red',
          },
        });
    });

    it('handles multiple objects with inline styles', () => {
      const styleA = {
        color: 'red',
      };

      const styleB = {
        display: 'inline-block',
      };

      expect(aphroditeInterface.resolve([styleA, styleB]))
        .to.eql({
          style: {
            color: 'red',
            display: 'inline-block',
          },
        });
    });

    it('prefers inline styles from later arguments', () => {
      const styleA = {
        color: 'red',
      };

      const styleB = {
        color: 'blue',
      };

      expect(aphroditeInterface.resolve([styleA, styleB]))
        .to.eql({
          style: {
            color: 'blue',
          },
        });
    });

    it('handles a mix of Aphrodite and inline styles', () => {
      const styles = aphroditeInterface.create({
        foo: {
          color: 'red',
        },
      });

      const style = {
        display: 'inline-block',
      };

      expect(aphroditeInterface.resolve([styles.foo, style]))
        .to.eql({
          className: 'foo_im3wl1',
          style: {
            display: 'inline-block',
          },
        });
    });

    it('handles nested arrays', () => {
      const styles = aphroditeInterface.create({
        foo: {
          color: 'red',
        },
      });

      const styleA = {
        display: 'inline-block',
      };

      const styleB = {
        padding: 1,
      };

      expect(aphroditeInterface.resolve([[styles.foo], [[styleA, styleB]]]))
        .to.eql({
          className: 'foo_im3wl1',
          style: {
            display: 'inline-block',
            padding: 1,
          },
        });
    });
  });
});
