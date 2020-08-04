import {deepEqual} from '../utils/deep-equal';
import {default as LightingEffect} from '../effects/lighting/lighting-effect';

export default class EffectManager {
  constructor() {
    this.effects = [];
    this._needsRedraw = 'Initial render';
    this.defaultLightingEffect = new LightingEffect();
    this.needApplyDefaultLighting = false;
  }

  setProps(props) {
    if ('effects' in props) {
      if (props.effects.length !== this.effects.length || !deepEqual(props.effects, this.effects)) {
        this.setEffects(props.effects);
        this._needsRedraw = 'effects changed';
      }
    }
    this.checkLightingEffect();
  }

  needsRedraw(opts = {clearRedrawFlags: false}) {
    const redraw = this._needsRedraw;
    if (opts.clearRedrawFlags) {
      this._needsRedraw = false;
    }
    return redraw;
  }

  getEffects() {
    let effects = this.effects;
    if (this.needApplyDefaultLighting) {
      effects = this.effects.slice();
      effects.push(this.defaultLightingEffect);
    }
    return effects;
  }

  finalize() {
    this.cleanup();
  }

  // Private
  setEffects(effects = []) {
    this.cleanup();
    this.effects = effects;
  }

  cleanup() {
    for (const effect of this.effects) {
      effect.cleanup();
    }
    this.effects.length = 0;
  }

  checkLightingEffect() {
    let hasEffect = false;
    for (const effect of this.effects) {
      if (effect instanceof LightingEffect) {
        hasEffect = true;
        break;
      }
    }
    this.needApplyDefaultLighting = !hasEffect;
  }
}
