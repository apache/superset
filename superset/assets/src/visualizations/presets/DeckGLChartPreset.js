import Preset from '../core/models/Preset';

export default class DeckGLChartPreset extends Preset {
  constructor() {
    super({
      name: 'deck.gl charts',
      plugins: [
      ],
    });
  }
}
