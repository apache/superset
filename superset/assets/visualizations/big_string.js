import d3 from 'd3';

require('./big_string.css');

function bigStringVis(slice, payload) {

  const div = d3.select(slice.selector);

  div.html(''); 

  const formDataVal = slice.formData;
  const jsonDataVal = payload.data;
  const formatVal = d3.format(formDataVal.y_axis_format);
  const formPerVal = d3.format('+.1%');

  const sliceWidth = slice.width();
  const sliceHeight = slice.height();

  const svg = div.append('svg');
  svg.attr('width', sliceWidth);
  svg.attr('height', sliceHeight);

  const data = jsonDataVal.data;

  let vizValCompare;
  let vizVal;

  if (formDataVal.viz_type === 'big_string') {
    vizVal = data[data.length - 1][1];
  } else {
    vizVal = data[0][0];
  }

  if (jsonDataVal.compare_lag > 0) {

    const position = data.length - (jsonDataVal.compare_lag + 1);
    if (position >= 0) {
      const vizAnchorVal = data[position][1];
      if (vizAnchorVal !== 0) {
        vizValCompare = (vizVal - vizAnchorVal) / Math.abs(vizAnchorVal);
      } else {
        vizValCompare = 0;
      }
    }
  }
  const dateExtentVal = d3.extent(data, d => d[0]);
  const valExtent = d3.extent(data, d => d[1]);

  const marginVal = 20;
  const scaleX = d3.time.scale.utc().domain(dateExtentVal).range([marginVal, sliceWidth - marginVal]);
  const scaleY = d3.scale.linear().domain(valExtent).range([sliceHeight - (marginVal), marginVal]);
  const colorRange = [d3.hsl(0, 1, 0.3), d3.hsl(120, 1, 0.3)];
  const scaleColor = d3.scale
  .linear().domain([-1, 1])
  .interpolate(d3.interpolateHsl)
  .range(colorRange)
  .clamp(true);
  const line = d3.svg.line()
  .x(function (d) {
    return scaleX(d[0]);
  })
  .y(function (d) {
    return scaleY(d[1]);
  })
  .interpolate('cardinal');

  let sliceHt = sliceHeight / 2;
  let svgAppn = svg.append('g');
  
  svgAppn.append('g').attr('class', 'digits')
  .attr('opacity', 1)
  .append('text')
  .attr('x', sliceWidth / 2)
  .attr('y', sliceHt)
  .attr('class', 'big')
  .attr('alignment-baseline', 'middle')
  .attr('id', 'bigString')
  .style('font-weight', 'bold')
  .style('cursor', 'pointer')
  .text(formatVal(vizVal))
  .style('font-size', d3.min([sliceHeight, sliceWidth]) / 3.5)
  .style('text-anchor', 'middle')
  .attr('fill', 'black');

  
  if (jsonDataVal.subheader !== null) {
    svgAppn.append('text')
    .attr('x', sliceWidth / 2)
    .attr('y', (sliceHeight / 16) * 12)
    .text(jsonDataVal.subheader)
    .attr('id', 'subheader_text')
    .style('font-size', d3.min([sliceHeight, width]) / 8)
    .style('text-anchor', 'middle');
  }

  if (formDataVal.viz_type === 'big_string') {
   
    svgAppn.append('path')
    .attr('d', function () {
      return line(data);
    })
    .attr('stroke-width', 5)
    .attr('opacity', 0.5)
    .attr('fill', 'none')
    .attr('stroke-linecap', 'round')
    .attr('stroke', 'grey');

    svgAppn = svg.append('g')
    .attr('class', 'digits')
    .attr('opacity', 1);

    if (vizValCompare !== null) {
      sliceHt = (sliceHeight / 8) * 3;
    }

    const colorVal = scaleColor(vizValCompare);

    if (vizValCompare) {
      svgAppn.append('text')
      .attr('x', sliceWidth / 2)
      .attr('sliceHt', (sliceHeight / 16) * 12)
      .text(formPerVal(vizValCompare) + jsonDataVal.compare_suffix)
      .style('font-size', d3.min([sliceHeight, sliceWidth]) / 8)
      .style('text-anchor', 'middle')
      .attr('fill', colorVal)
      .attr('stroke', colorVal);
    }

    const gAxis = svg.append('g').attr('class', 'axis').attr('opacity', 0);
    svgAppn = gAxis.append('g');
    const xAxis = d3.svg.axis()
    .scale(scaleX)
    .orient('bottom')
    .ticks(4)
    svgAppn.call(xAxis);
    svgAppn.attr('transform', 'translate(0,' + (sliceHeight - marginVal) + ')');

    svgAppn = gAxis.append('g').attr('transform', 'translate(' + (sliceWidth - marginVal) + ',0)');
    const yAxis = d3.svg.axis()
    .scale(scaleY)
    .orient('left')
    .tickFormat(d3.format(formDataVal.y_axis_format))
    .tickValues(valExtent);
    svgAppn.call(yAxis);
    svgAppn.selectAll('text')
    .style('text-anchor', 'end')
    .attr('y', '-7')
    .attr('x', '-4');

    svgAppn.selectAll('text')
    .style('font-size', '10px');

    // Define the div for the tooltip
    const tooltipEl =
      d3.select('body')
        .append('div')
        .attr('class', 'line-tooltip')
        .attr('width', 200)
        .attr('height', 200)
        .style('opacity', 0);

    const renderTooltip = (d) => {
      const value = formatVal(d[1]);
      return `
        <div>
          <span style="float: right">${value}</span>
        </div>
      `;
    };

    svg
      .selectAll('dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('r', 10)
      .attr('cx', d => scaleX(d[0]))
      .attr('cy', d => scaleY(d[1]))
      .attr('fill-opacity', '0')
      .on('mouseover', (d) => {
        tooltipEl.html(renderTooltip(d))
          .style('left', (d3.event.pageX) + 'px')
          .style('top', (d3.event.pageY) + 'px');
        tooltipEl.transition().duration(200).style('opacity', 0.9);
      })
      .on('mouseout', () => {
        tooltipEl.transition().duration(500).style('opacity', 0);
      });

    div.on('mouseover', function () {
      const el = d3.select(this);
      el.selectAll('path')
      .transition()
      .duration(500)
      .attr('opacity', 1)
      .style('stroke-width', '2px');
      el.selectAll('g.digits')
      .transition()
      .duration(500)
      .attr('opacity', 0.1);
      el.selectAll('g.axis')
      .transition()
      .duration(500)
      .attr('opacity', 1);
    })
    .on('mouseout', function () {
      const el = d3.select(this);
      el.select('path')
      .transition()
      .duration(500)
      .attr('opacity', 0.5)
      .style('stroke-width', '5px');
      el.selectAll('g.digits')
      .transition()
      .duration(500)
      .attr('opacity', 1);
      el.selectAll('g.axis')
      .transition()
      .duration(500)
      .attr('opacity', 0);
    });
  }
}

module.exports = bigStringVis;
