require('./country_map.css');
const d3 = require('d3');

function countryMapChart(slice, payload) {
  var centered, path, g, effectLayer, mapLayer, bigText, resultText;
  const container = slice.container;
  const data = payload.data;

  d3.select(slice.selector).selectAll('*').remove();
  const div = d3.select(slice.selector).append('svg:svg').attr('width', slice.width()).attr('height', slice.height()).attr('preserveAspectRatio', 'xMidYMid meet');

  container.css('height', slice.height());
  container.css('width', slice.width());

  centered = undefined;
  path = d3.geo.path();
  const color = d3.scale.linear()
    .domain([1, 20])
    .clamp(true)
    .range(['#fff', '#409A99']);

  div.append('rect')
    .attr('class', 'background')
    .attr('width', slice.width())
    .attr('height', slice.height())
    .on('click', clicked);

  g = div.append('g');

  effectLayer = g.append('g')
    .classed('effect-layer', true);

  mapLayer = g.append('g')
    .classed('map-layer', true);

  bigText = g.append('text')
    .classed('big-text', true)
    .attr('x', 20)
    .attr('y', 45);

  resultText = g.append('text')
    .classed('result-text', true)
    .attr('x', 20)
    .attr('y', 60);

  d3.json('/static/assets/visualizations/countries/' + payload.form_data.select_country.toLowerCase() + '.geojson', function (error, mapData) {
    var features, center, scale, offset, projection, bounds, hscale, vscale, scale, offset;
    
    features = mapData.features;
    center = d3.geo.centroid(mapData)
    scale = 150;
    offset = [slice.width() / 2, slice.height() / 2];
    projection = d3.geo.mercator().scale(scale).center(center).translate(offset);

    path = path.projection(projection);

    bounds = path.bounds(mapData);
    hscale = scale * slice.width() / (bounds[1][0] - bounds[0][0]);
    vscale = scale * slice.height() / (bounds[1][1] - bounds[0][1]);
    scale = (hscale < vscale) ? hscale : vscale;
    offset = [slice.width() - (bounds[0][0] + bounds[1][0]) / 2, slice.height() - (bounds[0][1] + bounds[1][1]) / 2];

    projection = d3.geo.mercator().center(center).scale(scale).translate(offset);
    path = path.projection(projection);
    color.domain([0, d3.max(features, nameLength)]);

    // Draw each province as a path
    mapLayer.selectAll('path')
      .data(features)
      .enter().append('path')
      .attr('d', path)
      .attr('vector-effect', 'non-scaling-stroke')
      .style('fill', fillFn)
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)
      .on('click', clicked);
  });

  const nameFn = function nameFn(d) {
    return d && d.properties ? d.properties.code : null;
  };
  const nameLength = function nameLength(d) {
    var n = nameFn(d);
    return n ? n.length : 0;
  };
  const fillFn = function fillFn(d) {
    return color(nameLength(d));
  };

  const clicked = function clicked(d) {
    var x, y, k, bigTextX, bigTextY, bigTextSize, resultTextX, resultTextY, centroid;

    if (d && centered !== d) {
      centroid = path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      bigTextX = centroid[0];
      bigTextY = centroid[1] - 40;
      resultTextX = centroid[0];
      resultTextY = centroid[1] - 40;
      bigTextSize = '6px';
      k = 4;
      centered = d;
    } else {
      x = slice.width() / 2;
      y = slice.height() / 2;
      bigTextX = 0;
      bigTextY = 0;
      resultTextX = 0;
      resultTextY = 0;
      bigTextSize = '30px';
      k = 1;
      centered = null;
    }

    g.transition()
      .duration(750)
      .attr('transform', 'translate(' + slice.width() / 2 + ',' + slice.height() / 2 + ')scale(' + k + ')translate(' + -x + ',' + -y + ')');
    bigText.transition()
      .duration(750)
      .attr('transform', 'translate(0,0)translate(' + bigTextX + ',' + bigTextY + ')')
      .style("font-size", bigTextSize);
    resultText.transition()
      .duration(750)
      .attr('transform', 'translate(0,0)translate(' + resultTextX + ',' + resultTextY + ')');
  };

  const textArt = function textArt(text) {
    bigText.text(text);
  };

  const updateResultText = function textArt(path) {
    var result = data.filter(function (region) {
      if (region.DEP === path.properties.code) {
        return region;
      }
    });
    if (result !== undefined) {
      resultText.text(d3.format(",")(result[0].metric));
    }
  };

  const mouseover = function mouseover(d) {
    d3.select(this).style('fill', 'orange');
    textArt(d && d.properties ? d.properties.nom : '');
    updateResultText(d && d.properties ? d : undefined);
  };

  const mouseout = function mouseout(d) {
    mapLayer.selectAll('path').style('fill', function (d) { return centered && d === centered ? '#D5708B' : fillFn(d); });
    bigText.text('');
    resultText.text('');
  };
  container.show();

}

module.exports = countryMapChart;