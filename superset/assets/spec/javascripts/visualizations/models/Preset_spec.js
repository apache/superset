import { describe, it } from 'mocha';
import { expect } from 'chai';
import Preset from '../../../../src/visualizations/core/models/Preset';
import Plugin from '../../../../src/visualizations/core/models/Plugin';

describe('Preset', () => {
  it('exists', () => {
    expect(Preset).to.not.equal(undefined);
  });

  describe('new Preset()', () => {
    it('creates new preset', () => {
      const preset = new Preset();
      expect(preset).to.be.instanceOf(Preset);
    });
  });

  describe('.register()', () => {
    it('register all listed presets then plugins', () => {
      const values = [];
      class Plugin1 extends Plugin {
        register() {
          values.push(1);
        }
      }
      class Plugin2 extends Plugin {
        register() {
          values.push(2);
        }
      }
      class Plugin3 extends Plugin {
        register() {
          values.push(3);
        }
      }
      class Plugin4 extends Plugin {
        register() {
          const { key } = this.config;
          values.push(key);
        }
      }

      const preset1 = new Preset({
        plugins: [new Plugin1()],
      });
      const preset2 = new Preset({
        plugins: [new Plugin2()],
      });
      const preset3 = new Preset({
        presets: [preset1, preset2],
        plugins: [
          new Plugin3(),
          new Plugin4().configure({ key: 'abc' }),
        ],
      });
      preset3.register();
      expect(values).to.deep.equal([1, 2, 3, 'abc']);
    });

    it('returns itself', () => {
      const preset = new Preset();
      expect(preset.register()).to.equal(preset);
    });
  });
});
