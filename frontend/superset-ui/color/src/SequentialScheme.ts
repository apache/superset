import { scaleLinear } from 'd3-scale';
import ColorScheme, { ColorSchemeConfig } from './ColorScheme';

function range(count: number) {
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push(i);
  }

  return values;
}

export interface SequentialSchemeConfig extends ColorSchemeConfig {
  isDiverging?: boolean;
}

export default class SequentialScheme extends ColorScheme {
  isDiverging: boolean;

  constructor(config: SequentialSchemeConfig) {
    super(config);
    const { isDiverging = false } = config;
    this.isDiverging = isDiverging;
  }

  createLinearScale(extent: number[] = [0, 1]) {
    // Create matching domain
    // because D3 continuous scale uses piecewise mapping
    // between domain and range.
    const valueScale = scaleLinear().range(extent);
    const denominator = this.colors.length - 1;
    const domain = range(this.colors.length).map(i => valueScale(i / denominator));

    return scaleLinear<string>()
      .domain(domain)
      .range(this.colors)
      .clamp(true);
  }

  getColors(numColors: number = this.colors.length): string[] {
    if (numColors === this.colors.length) {
      return this.colors;
    }
    const colorScale = this.createLinearScale();
    const denominator = numColors - 1;

    return range(numColors).map(i => colorScale(i / denominator));
  }
}
