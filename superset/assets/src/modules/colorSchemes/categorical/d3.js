import d3 from 'd3';
import CategoricalColorScheme from '../../CategoricalColorScheme';

const schemes = [
  {
    name: 'd3Category10',
    colors: d3.scale.category10().range(),
  },
  {
    name: 'd3Category20',
    colors: d3.scale.category20().range(),
  },
  {
    name: 'd3Category20b',
    colors: d3.scale.category20b().range(),
  },
  {
    name: 'd3Category20c',
    colors: d3.scale.category20c().range(),
  },
].map(s => new CategoricalColorScheme(s));

export default schemes;
