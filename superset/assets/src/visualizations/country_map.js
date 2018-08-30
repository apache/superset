import d3 from 'd3';
import PropTypes from 'prop-types';
import { colorScalerFactory } from '../modules/colors';
import './country_map.css';

const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    country_id: PropTypes.string,
    metric: PropTypes.number,
  })),
  width: PropTypes.number,
  height: PropTypes.number,
  country: PropTypes.string,
  linearColorScheme: PropTypes.string,
  mapBaseUrl: PropTypes.string,
  numberFormat: PropTypes.string,
};

const maps = {};

function CountryMap(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'CountryMap');

  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    mapBaseUrl = '/static/assets/src/visualizations/countries',
    numberFormat,
  } = props;

  const container = element;
  const format = d3.format(numberFormat);
  const colorScaler = colorScalerFactory(linearColorScheme, data, v => v.metric);
  const colorMap = {};
  data.forEach((d) => {
    colorMap[d.country_id] = colorScaler(d.metric);
  });
  const colorFn = d => colorMap[d.properties.ISO] || 'none';

  const path = d3.geo.path();
  const div = d3.select(container);
  div.selectAll('*').remove();
  container.style.height = `${height}px`;
  container.style.width = `${width}px`;
  const svg = div.append('svg:svg')
    .attr('width', width)
    .attr('height', height)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  const backgroundRect = svg.append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height);
  const g = svg.append('g');
  const mapLayer = g.append('g')
    .classed('map-layer', true);
  const textLayer = g.append('g')
    .classed('text-layer', true)
    .attr('transform', `translate(${width / 2}, 45)`);
  const bigText = textLayer.append('text')
    .classed('big-text', true);
  const resultText = textLayer.append('text')
    .classed('result-text', true)
    .attr('dy', '1em');

  let centered;

  const clicked = function (d) {
    const hasCenter = d && centered !== d;
    let x;
    let y;
    let k;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    if (hasCenter) {
      const centroid = path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      k = 4;
      centered = d;
    } else {
      x = halfWidth;
      y = halfHeight;
      k = 1;
      centered = null;
    }

    g.transition()
      .duration(750)
      .attr('transform', `translate(${halfWidth},${halfHeight})scale(${k})translate(${-x},${-y})`);
    textLayer
        .style('opacity', 0)
        .attr('transform', `translate(0,0)translate(${x},${hasCenter ? (y - 5) : 45})`)
      .transition()
        .duration(750)
        .style('opacity', 1);
    bigText.transition()
      .duration(750)
      .style('font-size', hasCenter ? 6 : 16);
    resultText.transition()
      .duration(750)
      .style('font-size', hasCenter ? 16 : 24);
  };

  backgroundRect.on('click', clicked);

  const selectAndDisplayNameOfRegion = function (feature) {
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

  const updateMetrics = function (region) {
    if (region.length > 0) {
      resultText.text(format(region[0].metric));
    }
  };

  const mouseenter = function (d) {
    // Darken color
    let c = colorFn(d);
    if (c !== 'none') {
      c = d3.rgb(c).darker().toString();
    }
    d3.select(this).style('fill', c);
    selectAndDisplayNameOfRegion(d);
    const result = data.filter(region => region.country_id === d.properties.ISO);
    updateMetrics(result);
  };

  const mouseout = function () {
    d3.select(this).style('fill', colorFn);
    bigText.text('');
    resultText.text('');
  };

  function drawMap(mapData) {
    const features = mapData.features;
    const center = d3.geo.centroid(mapData);
    const scale = 100;
    const projection = d3.geo.mercator()
      .scale(scale)
      .center(center)
      .translate([width / 2, height / 2]);
    path.projection(projection);

    // Compute scale that fits container.
    const bounds = path.bounds(mapData);
    const hscale = scale * width / (bounds[1][0] - bounds[0][0]);
    const vscale = scale * height / (bounds[1][1] - bounds[0][1]);
    const newScale = (hscale < vscale) ? hscale : vscale;

    // Compute bounds and offset using the updated scale.
    projection.scale(newScale);
    const newBounds = path.bounds(mapData);
    projection.translate([
      width - (newBounds[0][0] + newBounds[1][0]) / 2,
      height - (newBounds[0][1] + newBounds[1][1]) / 2,
    ]);

    // Draw each province as a path
    mapLayer.selectAll('path')
      .data(features)
      .enter().append('path')
      .attr('d', path)
      .attr('class', 'region')
      .attr('vector-effect', 'non-scaling-stroke')
      .style('fill', colorFn)
      .on('mouseenter', mouseenter)
      .on('mouseout', mouseout)
      .on('click', clicked);
  }

  const countryKey = country.toLowerCase();
  const map = maps[countryKey];
  if (map) {
    drawMap(map);
  } else {
    const url = `${mapBaseUrl}/${countryKey}.geojson`;
    d3.json(url, function (error, mapData) {
      if (!error) {
        maps[countryKey] = mapData;
        drawMap(mapData);
      }
    });
  }

}

CountryMap.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const {
    linear_color_scheme: linearColorScheme,
    number_format: numberFormat,
    select_country: country,
  } = formData;
  const element = document.querySelector(selector);

  return CountryMap(element, {
    data: payload.data,
    width: slice.width(),
    height: slice.height(),
    country,
    linearColorScheme,
    numberFormat,
  });
}

export default adaptor;
