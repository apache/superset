import d3 from 'd3';
import './country_map.css';
import { colorScalerFactory } from '../javascripts/modules/colors';


function countryMapChart(slice, payload) {
  // CONSTANTES
  let path;
  let g;
  let mapLayer;
  let bigText;
  let resultText;
  const color = d3.scale.category20();
  const container = slice.container;
  const data = payload.data;
  const colorForScaler = ['#90eb9d', '#ffff8c', '#f9d057', '#f29e2e', '#e76818', '#d7191c'];
  const colorsByMetrics = colorScalerFactory(colorForScaler, data, function (value) {
    return value.metric;
  });

  let centered;
  path = d3.geo.path();
  d3.select(slice.selector).selectAll('*').remove();
  const div = d3.select(slice.selector)
    .append('svg:svg')
    .attr('width', slice.width())
    .attr('height', slice.height())
    .attr('preserveAspectRatio', 'xMidYMid meet');

  container.css('height', slice.height());
  container.css('width', slice.width());

  const getIdOfCountry = function getIdOfCountry(feature) {
    return feature && feature.properties && feature.properties.NAME_0 ? feature.properties.ID_0 : 0;
  };

  const nameLength = function nameLength(feature) {
    const idOfPays = getIdOfCountry(feature);
    return idOfPays;
  };

  const fillFn = function fillFn(d) {
    return color(getIdOfCountry(d));
  };

  const clicked = function clicked(d) {
    let x;
    let y;
    let k;
    let bigTextX;
    let bigTextY;
    let bigTextSize;
    let resultTextX;
    let resultTextY;

    if (d && centered !== d) {
      const centroid = path.centroid(d);
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
      .style('font-size', bigTextSize);
    resultText.transition()
      .duration(750)
      .attr('transform', 'translate(0,0)translate(' + resultTextX + ',' + resultTextY + ')');
  };

  const selectAndDisplayNameOfRegion = function selectAndDisplayNameOfRegion(feature) {
    let name = '';
    if (feature && feature.properties) {
      if (feature.properties.ID_2) {
        name = feature.properties.NAME_2;
      } else {
        name = feature.properties.NAME_1;
      }
    }
    bigText.text(name);
  };

  const updateMetrics = function updateMetrics(region) {
    if (region.length > 0) {
      resultText.text(d3.format(',')(region[0].metric));
    }
  };


  const mouseover = function mouseover(d) {
    const result = data.filter(function (region) {
      if (region.country_id === d.properties.ISO) {
        return region;
      }
      return undefined;
    });
    d3.select(this).style('fill', d3.rgb(colorsByMetrics(result[0].metric)));
    selectAndDisplayNameOfRegion(d);
    updateMetrics(result);
  };

  const mouseout = function mouseout() {
    mapLayer.selectAll('path').style('fill', function (d) { return centered && d === centered ? '#D5708B' : fillFn(d); });
    bigText.text('');
    resultText.text('');
  };

  div.append('rect')
    .attr('class', 'background')
    .attr('width', slice.width())
    .attr('height', slice.height())
    .on('click', clicked);

  g = div.append('g');
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
    const features = mapData.features;
    const center = d3.geo.centroid(mapData);
    let scale = 150;
    let offset = [slice.width() / 2, slice.height() / 2];
    let projection = d3.geo.mercator().scale(scale).center(center)
      .translate(offset);

    path = path.projection(projection);

    const bounds = path.bounds(mapData);
    const hscale = scale * slice.width() / (bounds[1][0] - bounds[0][0]);
    const vscale = scale * slice.height() / (bounds[1][1] - bounds[0][1]);
    scale = (hscale < vscale) ? hscale : vscale;
    const offsetWidth = slice.width() - (bounds[0][0] + bounds[1][0]) / 2;
    const offsetHeigth = slice.height() - (bounds[0][1] + bounds[1][1]) / 2;
    offset = [offsetWidth, offsetHeigth];
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
  container.show();
}

module.exports = countryMapChart;
