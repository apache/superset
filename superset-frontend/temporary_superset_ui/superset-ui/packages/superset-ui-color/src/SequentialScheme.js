import { scaleLinear } from 'd3-scale';
import ColorScheme from './ColorScheme';

function range(count) {
  return [...Array(count).keys()];
}

export default class SequentialScheme extends ColorScheme {
  constructor(input) {
    super(input);
    const { isDiverging = false } = input;
    this.isDiverging = isDiverging;
  }

  createLinearScale(extent = [0, 1]) {
    // Create matching domain
    // because D3 continuous scale uses piecewise mapping
    // between domain and range.
    const valueScale = scaleLinear().range(extent);
    const denominator = this.colors.length - 1;
    const domain = range(this.colors.length).map(i => valueScale(i / denominator));

    return scaleLinear()
      .domain(domain)
      .range(this.colors)
      .clamp(true);
  }

  getColors(numColors = this.colors.length) {
    if (numColors === this.colors.length) {
      return this.colors;
    }
    const colorScale = this.createLinearScale();
    const denominator = numColors - 1;

    return range(numColors).map(i => colorScale(i / denominator));
  }
}
