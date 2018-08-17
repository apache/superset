import d3 from 'd3';
import cloudLayout from 'd3-cloud';
import { getColorFromScheme } from '../modules/colors';

const ROTATION = {
  square: () => Math.floor((Math.random() * 2)) * 90,
  flat: () => 0,
  random: () => Math.floor(((Math.random() * 6) - 3)) * 30,
};

function wordCloud(element, data, {
  width,
  height,
  rotation,
  sizeRange,
  colorScheme,
}) {
  const chart = d3.select(element);
  const size = [width, height];
  const rotationFn = ROTATION[rotation] || ROTATION.random;

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
        .style('fill', d => getColorFromScheme(d.text, colorScheme))
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.rotate})`)
        .text(d => d.text);
  }

  layout.on('end', draw).start();
}

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const {
    rotation,
    size_to: sizeTo,
    size_from: sizeFrom,
    color_scheme: colorScheme,
  } = formData;
  const element = document.querySelector(selector);
  const data = payload.data;

  return wordCloud(element, data, {
    width: slice.width(),
    height: slice.height(),
    rotation,
    sizeRange: [sizeFrom, sizeTo],
    colorScheme,
  });
}

module.exports = adaptor;
