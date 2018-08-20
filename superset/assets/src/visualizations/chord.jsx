/* eslint-disable no-param-reassign */
import d3 from 'd3';
import PropTypes from 'prop-types';
import { getColorFromScheme } from '../modules/colors';
import './chord.css';

const propTypes = {
  data: PropTypes.shape({
    nodes: PropTypes.arrayOf(PropTypes.string),
    matrix: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  }),
  width: PropTypes.number,
  height: PropTypes.number,
  numberFormat: PropTypes.string,
  colorScheme: PropTypes.string,
};

function chordVis(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'ChordVis');

  const {
    data,
    width,
    height,
    numberFormat,
    colorScheme,
  } = props;

  element.innerHTML = '';

  const div = d3.select(element);
  const { nodes, matrix } = data;
  const f = d3.format(numberFormat);

  const outerRadius = Math.min(width, height) / 2 - 10;
  const innerRadius = outerRadius - 24;

  let chord;

  const arc = d3.svg.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  const layout = d3.layout.chord()
    .padding(0.04)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  const path = d3.svg.chord()
    .radius(innerRadius);

  const svg = div.append('svg')
    .attr('width', width)
    .attr('height', height)
    .on('mouseout', () => chord.classed('fade', false))
    .append('g')
    .attr('id', 'circle')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  svg.append('circle')
    .attr('r', outerRadius);

  // Compute the chord layout.
  layout.matrix(matrix);

  const group = svg.selectAll('.group')
    .data(layout.groups)
    .enter().append('g')
    .attr('class', 'group')
    .on('mouseover', (d, i) => {
      chord.classed('fade', p => p.source.index !== i && p.target.index !== i);
    });

  // Add a mouseover title.
  group.append('title').text((d, i) => `${nodes[i]}: ${f(d.value)}`);

  // Add the group arc.
  const groupPath = group.append('path')
    .attr('id', (d, i) => 'group' + i)
    .attr('d', arc)
    .style('fill', (d, i) => getColorFromScheme(nodes[i], colorScheme));

  // Add a text label.
  const groupText = group.append('text')
    .attr('x', 6)
    .attr('dy', 15);

  groupText.append('textPath')
    .attr('xlink:href', (d, i) => `#group${i}`)
    .text((d, i) => nodes[i]);
  // Remove the labels that don't fit. :(
  groupText.filter(function (d, i) {
    return groupPath[0][i].getTotalLength() / 2 - 16 < this.getComputedTextLength();
  })
  .remove();

  // Add the chords.
  chord = svg.selectAll('.chord')
    .data(layout.chords)
    .enter().append('path')
    .attr('class', 'chord')
    .on('mouseover', (d) => {
      chord.classed('fade', p => p !== d);
    })
    .style('fill', d => getColorFromScheme(nodes[d.source.index], colorScheme))
    .attr('d', path);

  // Add an elaborate mouseover title for each chord.
  chord.append('title').text(function (d) {
    return nodes[d.source.index]
    + ' → ' + nodes[d.target.index]
    + ': ' + f(d.source.value)
    + '\n' + nodes[d.target.index]
    + ' → ' + nodes[d.source.index]
    + ': ' + f(d.target.value);
  });
}

chordVis.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const { y_axis_format: numberFormat, color_scheme: colorScheme } = formData;
  const element = document.querySelector(selector);

  return chordVis(element, {
    data: payload.data,
    width: slice.width(),
    height: slice.height(),
    numberFormat,
    colorScheme,
  });
}

export default adaptor;
