/* eslint-disable no-param-reassign */
import d3 from 'd3';
import PropTypes from 'prop-types';
import { sankey as d3Sankey } from 'd3-sankey';
import { getColorFromScheme } from '../modules/colors';
import './sankey.css';

const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    source: PropTypes.string,
    target: PropTypes.string,
    value: PropTypes.number,
  })),
  width: PropTypes.number,
  height: PropTypes.number,
  colorScheme: PropTypes.string,
};

const formatNumber = d3.format(',.2f');

function Sankey(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'Sankey');

  const {
    data,
    width,
    height,
    colorScheme,
  } = props;

  const div = d3.select(element);
  const margin = {
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  div.selectAll('*').remove();
  const svg = div.append('svg')
    .attr('width', innerWidth + margin.left + margin.right)
    .attr('height', innerHeight + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  const tooltip = div.append('div')
    .attr('class', 'sankey-tooltip')
    .style('opacity', 0);

  const sankey = d3Sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .size([innerWidth, innerHeight]);

  const path = sankey.link();

  let nodes = {};
  // Compute the distinct nodes from the links.
  const links = data.map(function (row) {
    const link = Object.assign({}, row);
    link.source = nodes[link.source] || (nodes[link.source] = { name: link.source });
    link.target = nodes[link.target] || (nodes[link.target] = { name: link.target });
    link.value = Number(link.value);
    return link;
  });
  nodes = d3.values(nodes);

  sankey
    .nodes(nodes)
    .links(links)
    .layout(32);

  function getTooltipHtml(d) {
    let html;

    if (d.sourceLinks) { // is node
      html = d.name + " Value: <span class='emph'>" + formatNumber(d.value) + '</span>';
    } else {
      const val = formatNumber(d.value);
      const sourcePercent = d3.round((d.value / d.source.value) * 100, 1);
      const targetPercent = d3.round((d.value / d.target.value) * 100, 1);

      html = [
        "<div class=''>Path Value: <span class='emph'>", val, '</span></div>',
        "<div class='percents'>",
        "<span class='emph'>",
        (isFinite(sourcePercent) ? sourcePercent : '100'),
        '%</span> of ', d.source.name, '<br/>',
        "<span class='emph'>" +
        (isFinite(targetPercent) ? targetPercent : '--') +
        '%</span> of ', d.target.name, 'target',
        '</div>',
      ].join('');
    }
    return html;
  }

  function onmouseover(d) {
    tooltip
      .html(function () { return getTooltipHtml(d); })
     .transition()
      .duration(200)
      .style('left', (d3.event.offsetX + 10) + 'px')
      .style('top', (d3.event.offsetY + 10) + 'px')
      .style('opacity', 0.95);
  }

  function onmouseout() {
    tooltip.transition()
      .duration(100)
      .style('opacity', 0);
  }

  const link = svg.append('g').selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', path)
    .style('stroke-width', d => Math.max(1, d.dy))
    .sort((a, b) => b.dy - a.dy)
    .on('mouseover', onmouseover)
    .on('mouseout', onmouseout);

  function dragmove(d) {
    d3.select(this)
      .attr(
        'transform',
        `translate(${d.x},${(d.y = Math.max(0, Math.min(height - d.dy, d3.event.y)))})`,
      );
    sankey.relayout();
    link.attr('d', path);
  }

  const node = svg.append('g').selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
    .call(d3.behavior.drag()
      .origin(d => d)
      .on('dragstart', function () {
        this.parentNode.appendChild(this);
      })
      .on('drag', dragmove),
    );
  const minRectHeight = 5;
  node.append('rect')
    .attr('height', d => d.dy > minRectHeight ? d.dy : minRectHeight)
    .attr('width', sankey.nodeWidth())
    .style('fill', function (d) {
      const name = d.name || 'N/A';
      d.color = getColorFromScheme(name.replace(/ .*/, ''), colorScheme);
      return d.color;
    })
    .style('stroke', d => d3.rgb(d.color).darker(2))
    .on('mouseover', onmouseover)
    .on('mouseout', onmouseout);

  node.append('text')
    .attr('x', -6)
    .attr('y', d => d.dy / 2)
    .attr('dy', '.35em')
    .attr('text-anchor', 'end')
    .attr('transform', null)
    .text(d => d.name)
    .filter(d => d.x < innerWidth / 2)
    .attr('x', 6 + sankey.nodeWidth())
    .attr('text-anchor', 'start');
}

Sankey.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const { color_scheme: colorScheme } = formData;
  const element = document.querySelector(selector);

  return Sankey(element, {
    data: payload.data,
    width: slice.width(),
    height: slice.height(),
    colorScheme,
  });
}

export default adaptor;
