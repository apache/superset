import ColorScheme from './ColorScheme';

export default class SequentialScheme extends ColorScheme {
  constructor(input) {
    super(input);
    const { isDiverging = false } = input;
    this.isDiverging = isDiverging;
  }
}
