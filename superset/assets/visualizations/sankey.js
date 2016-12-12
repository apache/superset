/* eslint-disable no-param-reassign */
import { category21 } from '../javascripts/modules/colors';
import d3 from 'd3';

d3.sankey = require('d3-sankey').sankey;

require('./sankey.css');

function sankeyVis(slice) {
  const div = d3.select(slice.selector);
  const render = function () {
    const margin = {
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
    };
    const width = slice.width() - margin.left - margin.right;
    const height = slice.height() - margin.top - margin.bottom;

    const formatNumber = d3.format(',.2f');

    div.selectAll('*').remove();
    const svg = div.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    const tooltip = div.append('div')
      .attr('class', 'sankey-tooltip')
      .style('opacity', 0);

    const sankey = d3.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .size([width, height]);

    const path = sankey.link();

    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }
      let nodes = {};
      // Compute the distinct nodes from the links.
      const links = json.data.map(function (row) {
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
        .style('stroke-width', (d) => Math.max(1, d.dy))
        .sort((a, b) => b.dy - a.dy)
        .on('mouseover', onmouseover)
        .on('mouseout', onmouseout);

      function dragmove(d) {
        d3.select(this)
          .attr(
            'transform',
            `translate(${d.x},${(d.y = Math.max(0, Math.min(height - d.dy, d3.event.y)))})`
          );
        sankey.relayout();
        link.attr('d', path);
      }

      const node = svg.append('g').selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', function (d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        })
        .call(d3.behavior.drag()
          .origin(function (d) {
            return d;
          })
          .on('dragstart', function () {
            this.parentNode.appendChild(this);
          })
          .on('drag', dragmove)
        );

      node.append('rect')
        .attr('height', function (d) {
          return d.dy;
        })
        .attr('width', sankey.nodeWidth())
        .style('fill', function (d) {
          d.color = category21(d.name.replace(/ .*/, ''));
          return d.color;
        })
        .style('stroke', function (d) {
          return d3.rgb(d.color).darker(2);
        })
        .on('mouseover', onmouseover)
        .on('mouseout', onmouseout);

      node.append('text')
        .attr('x', -6)
        .attr('y', function (d) {
          return d.dy / 2;
        })
        .attr('dy', '.35em')
        .attr('text-anchor', 'end')
        .attr('transform', null)
        .text(function (d) {
          return d.name;
        })
        .filter(function (d) {
          return d.x < width / 2;
        })
        .attr('x', 6 + sankey.nodeWidth())
        .attr('text-anchor', 'start');


      slice.done(json);
    });
  };
  return {
    render,
    resize: render,
  };
}

module.exports = sankeyVis;
