declare module '@vx/scale' {
  import { ScaleOrdinal } from 'd3-scale';

  // eslint-disable-next-line import/prefer-default-export
  export function scaleOrdinal<Domain = string, Range = string>(input: {
    domain: Domain[];
    range: Range[];
  }): ScaleOrdinal<Domain, Range>;
}
