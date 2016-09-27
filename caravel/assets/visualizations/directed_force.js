/* eslint-disable no-param-reassign */
import d3 from 'd3';

require('./directed_force.css');

/* Modified from http://bl.ocks.org/d3noob/5141278 */
function directedForceVis(slice) {
  const div = d3.select(slice.selector);

  const render = function () {
    const width = slice.width();
    const height = slice.height() - 25;
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }
      const linkLength = json.form_data.link_length || 200;
      const charge = json.form_data.charge || -500;

      const links = json.data;
      const nodes = {};
      // Compute the distinct nodes from the links.
      links.forEach(function (link) {
        link.source = nodes[link.source] || (nodes[link.source] = {
          name: link.source,
        });
        link.target = nodes[link.target] || (nodes[link.target] = {
          name: link.target,
        });
        link.value = Number(link.value);

        const targetName = link.target.name;
        const sourceName = link.source.name;

        if (nodes[targetName].total === undefined) {
          nodes[targetName].total = link.value;
        }
        if (nodes[sourceName].total === undefined) {
          nodes[sourceName].total = 0;
        }
        if (nodes[targetName].max === undefined) {
          nodes[targetName].max = 0;
        }
        if (link.value > nodes[targetName].max) {
          nodes[targetName].max = link.value;
        }
        if (nodes[targetName].min === undefined) {
          nodes[targetName].min = 0;
        }
        if (link.value > nodes[targetName].min) {
          nodes[targetName].min = link.value;
        }

        nodes[targetName].total += link.value;
      });

      /* eslint-disable no-use-before-define */
      // add the curvy lines
      function tick() {
        path.attr('d', function (d) {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dr = Math.sqrt(dx * dx + dy * dy);
          return (
            'M' +
            d.source.x + ',' +
            d.source.y + 'A' +
            dr + ',' + dr + ' 0 0,1 ' +
            d.target.x + ',' +
            d.target.y
          );
        });

        node.attr('transform', function (d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        });
      }
      /* eslint-enable no-use-before-define */

      const force = d3.layout.force()
      .nodes(d3.values(nodes))
      .links(links)
      .size([width, height])
      .linkDistance(linkLength)
      .charge(charge)
      .on('tick', tick)
      .start();

      div.selectAll('*').remove();
      const svg = div.append('svg')
      .attr('width', width)
      .attr('height', height);

      // build the arrow.
      svg.append('svg:defs').selectAll('marker')
      .data(['end']) // Different link/path types can be defined here
      .enter()
      .append('svg:marker') // This section adds in the arrows
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', -1.5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

      const edgeScale = d3.scale.linear()
      .range([0.1, 0.5]);
      // add the links and the arrows
      const path = svg.append('svg:g').selectAll('path')
      .data(force.links())
      .enter()
      .append('svg:path')
      .attr('class', 'link')
      .style('opacity', function (d) {
        return edgeScale(d.value / d.target.max);
      })
      .attr('marker-end', 'url(#end)');

      // define the nodes
      const node = svg.selectAll('.node')
      .data(force.nodes())
      .enter()
      .append('g')
      .attr('class', 'node')
      .on('mouseenter', function () {
        d3.select(this)
        .select('circle')
        .transition()
        .style('stroke-width', 5);

        d3.select(this)
        .select('text')
        .transition()
        .style('font-size', 25);
      })
      .on('mouseleave', function () {
        d3.select(this)
        .select('circle')
        .transition()
        .style('stroke-width', 1.5);
        d3.select(this)
        .select('text')
        .transition()
        .style('font-size', 12);
      })
      .call(force.drag);

      // add the nodes
      const ext = d3.extent(d3.values(nodes), function (d) {
        return Math.sqrt(d.total);
      });
      const circleScale = d3.scale.linear()
      .domain(ext)
      .range([3, 30]);

      node.append('circle')
      .attr('r', function (d) {
        return circleScale(Math.sqrt(d.total));
      });

      // add the text
      node.append('text')
      .attr('x', 6)
      .attr('dy', '.35em')
      .text(function (d) {
        return d.name;
      });

      slice.done(json);
    });
  };
  return {
    render,
    resize: render,
  };
}

module.exports = directedForceVis;
