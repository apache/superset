/* eslint-disable no-shadow, no-param-reassign, no-underscore-dangle, no-use-before-define*/
import d3 from 'd3';
// import { category21 } from '../javascripts/modules/colors';

require('./mekko.css');

/* Modified from http://bl.ocks.org/ganeshv/6a8e9ada3ab7f2d88022 */
function mekko(slice) {
  const div = d3.select(slice.selector);

  /* Get the data into the right format */
  const _reshape = function (data) {
    const dataArray = [];
    const arr = data.children;
    let x;
    let y;
    let t;
    let v;
    let i;
    let j;

    // let xName;
    // let yName;
    // dataArray = [];
    // arr = data.children;

    for (i = 0; i < arr.length; i++) {
      x = arr[i].name;
      t = arr[i].children;
      for (j = 0; j < t.length; j++) {
        y = t[j].name;
        v = t[j].value;
        if (v !== 0) {
          dataArray.push({ x_group: x, y_group: y, value: v });
        }
      }
    }
    return dataArray;
  };


  const _draw = function (_data, eltWidth, eltHeight, formData) {
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const navBarHeight = 36;
    const navBarTitleSize = navBarHeight / 3;
    const navBarBuffer = 10;
    const width = eltWidth - margin.left - margin.right;
    const height = (eltHeight - navBarHeight - navBarBuffer - margin.top - margin.bottom);
    const formatNumber = d3.format(formData.number_format);

    // const x = d3.scale.linear()
    //   .domain([0, width])
    //   .range([0, width]);
    //
    // const y = d3.scale.linear()
    //   .domain([0, height])
    //   .range([0, height]);

    const svg = div.append('svg')
      .attr('width', eltWidth)
      .attr('height', eltHeight);

    const chartContainer = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' +
        (margin.top + navBarHeight + navBarBuffer) + ')')
      .style('shape-rendering', 'crispEdges');

    const grandparent = svg.append('g')
      .attr('class', 'grandparent')
      .attr('transform', 'translate(0,' + (margin.top + navBarBuffer / 2) + ')');

    grandparent.append('rect')
      .attr('width', width)
      .attr('height', navBarHeight);

    grandparent.append('text')
      .attr('x', width / 2)
      .attr('y', navBarHeight / 2 + navBarTitleSize / 2)
      .style('font-size', navBarTitleSize + 'px')
      .style('text-anchor', 'middle');

    // Consistent colour scheme
    // const color = category21;
    const color = d3.scale.category10();

    // Get the date in the correct shape
    const data = _reshape(_data);

    const nest = d3.nest()
      .key(function (d) {
        return d.x_group;
      })
      .key(function (d) {
        return d.y_group;
      });

    const treemap = d3.layout.treemap()
      .mode('slice-dice')
      .padding(function (d) {
        return d.depth > 1 ? 1 : 0;
      })
      .size([width, height])
      .children(function (d) {
        return d.values;
      })
      .sort(null);

    // Main graph
    chartContainer.datum({ values: nest.entries(data) }).call(chart);

    // x-Axis
    chartContainer.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + treemap.size()[1] + ')')
      .call(d3.svg.axis().scale(d3.scale.linear().range(
        [0, treemap.size()[0]])).tickFormat(d3.format('%')));

    // y-Axis
    chartContainer.append('g')
      .attr('class', 'y axis')
      .call(d3.svg.axis()
        .scale(d3.scale.linear().range([treemap.size()[1], 0]))
        .tickFormat(d3.format('%'))
        .orient('left'));

    // const text2 = function (selection) {
    //   selection.attr('x', function (d) {
    //     return x(d.x + d.dx) - this.getComputedTextLength() - 6;
    //   })
    //     .attr('y', function (d) {
    //       return y(d.y + d.dy) - 6;
    //     })
    //     .style('opacity', function (d) {
    //       return this.getComputedTextLength() < x(d.x + d.dx) - x(d.x) ? 1 : 0;
    //     });
    // };

    function chart(selection) {
      selection.each(function () {
        const cell = d3.select(this).selectAll('g.cell')
          .data(treemap.nodes);

        const cellEnter = cell.enter().append('g')
          .attr('class', 'cell')
          .attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
          });

        cellEnter.filter(function (d) {
          return d.depth > 2;
        }).append('rect')
          .style('fill', function (d) {
            return d.children ? null : color(d.y_group);
          });

        cellEnter.append('title');

        d3.transition(cell)
          .attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
          })
          .select('rect')
          .attr('width', function (d) {
            return d.dx;
          })
          .attr('height', function (d) {
            return d.dy;
          });

        cellEnter.filter(function (d) {
          return d.depth > 2;
        }).append('text')
          .attr('class', 'label')
          .attr('transform', 'translate(6, 10)')
          .attr('width', function (d) {
            return Math.max(0.01, d.dx);
          })
          .attr('height', 25)
          .text(function (d) {
            if (d.value > 0) {
              return title(d);
            }
            return '';
          });


        cell.select('title')
          .text(function (d) {
            return d.children ? null : title(d);
          });

        d3.transition(cell.exit())
          .attr('width', 1e-6)
          .attr('height', 1e-6)
          .remove();
      });
    }

    function title(d) {
      return d.x_group + ': ' + d.parent.key + ': ' + formatNumber(d.value);
    }
  };

  const render = function () {
    // console.log(slice.jsonEndpoint());
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }

      div.selectAll('*').remove();
      const width = slice.width();
      // facet multiple metrics (no sense in combining)
      const height = slice.height() / json.data.length;
      for (let i = 0, l = json.data.length; i < l; i++) {
        _draw(json.data[i], width, height, json.form_data);
      }

      slice.done(json);
    });
  };

  return {
    render,
    resize: render,
  };
}

module.exports = mekko;

