import ColorScheme from './ColorScheme';

export default class SequentialScheme extends ColorScheme {
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
