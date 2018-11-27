import d3 from 'd3';
import PropTypes from 'prop-types';
import cloudLayout from 'd3-cloud';
import { CategoricalColorNamespace } from '@superset-ui/color';

const ROTATION = {
  square: () => Math.floor((Math.random() * 2)) * 90,
  flat: () => 0,
  random: () => Math.floor(((Math.random() * 6) - 3)) * 30,
};

const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    size: PropTypes.number,
    text: PropTypes.string,
  })),
  width: PropTypes.number,
  height: PropTypes.number,
  rotation: PropTypes.string,
  sizeRange: PropTypes.arrayOf(PropTypes.number),
  colorScheme: PropTypes.string,
};

function WordCloud(element, props) {
  const {
    data,
    width,
    height,
    rotation,
    sizeRange,
    colorScheme,
  } = props;

  const chart = d3.select(element);
  const size = [width, height];
  const rotationFn = ROTATION[rotation] || ROTATION.flat;

  const scale = d3.scale.linear()
    .range(sizeRange)
    .domain(d3.extent(data, d => d.size));

  const layout = cloudLayout()
    .size(size)
    .words(data)
    .padding(5)
    .rotate(rotationFn)
    .font('Helvetica')
    .fontWeight('bold')
    .fontSize(d => scale(d.size));

  const colorFn = CategoricalColorNamespace.getScale(colorScheme).toFunction();

  function draw(words) {
    chart.selectAll('*').remove();

    const [w, h] = layout.size();

    chart.append('svg')
        .attr('width', w)
        .attr('height', h)
      .append('g')
        .attr('transform', `translate(${w / 2},${h / 2})`)
      .selectAll('text')
        .data(words)
      .enter()
        .append('text')
        .style('font-size', d => `${d.size}px`)
        .style('font-weight', 'bold')
        .style('font-family', 'Helvetica')
        .style('fill', d => colorFn(d.text))
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.rotate})`)
        .text(d => d.text);
  }

  layout.on('end', draw).start();
}

WordCloud.displayName = 'WordCloud';
WordCloud.propTypes = propTypes;

export default WordCloud;
