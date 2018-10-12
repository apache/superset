import ColorScheme from './ColorScheme';

export default class SequentialColorScheme extends ColorScheme {
  constructor({
    name,
    colors,
    description,
    isDiverging = false,
  }) {
    super({ name, colors, description });
    this.isDiverging = isDiverging;
  }
}
