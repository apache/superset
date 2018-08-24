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
  numberFormat: PropTypes.string,
};

function CountryMap(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'CountryMap');

  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    numberFormat,
  } = props;

  let path;
  let g;
  let bigText;
  let resultText;

  const container = element;
  const format = d3.format(numberFormat);
  const colorScaler = colorScalerFactory(linearColorScheme, data, v => v.metric);
  const colorMap = {};
  data.forEach((d) => {
    colorMap[d.country_id] = colorScaler(d.metric);
  });
  const colorFn = d => colorMap[d.properties.ISO] || 'none';

  path = d3.geo.path();
  const div = d3.select(container);
  div.selectAll('*').remove();
  const svg = div.append('svg:svg')
    .attr('width', width)
    .attr('height', height)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  container.style.height = `${height}px`;
  container.style.width = `${width}px`;

  let centered;

  const clicked = function (d) {
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
      x = width / 2;
      y = height / 2;
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
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')scale(' + k + ')translate(' + -x + ',' + -y + ')');
    bigText.transition()
      .duration(750)
      .attr('transform', 'translate(0,0)translate(' + bigTextX + ',' + bigTextY + ')')
      .style('font-size', bigTextSize);
    resultText.transition()
      .duration(750)
      .attr('transform', 'translate(0,0)translate(' + resultTextX + ',' + resultTextY + ')');
  };

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

  svg.append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height)
    .on('click', clicked);

  g = svg.append('g');
  const mapLayer = g.append('g')
    .classed('map-layer', true);
  bigText = g.append('text')
    .classed('big-text', true)
    .attr('x', 20)
    .attr('y', 45);
  resultText = g.append('text')
    .classed('result-text', true)
    .attr('x', 20)
    .attr('y', 60);

  const url = `/static/assets/src/visualizations/countries/${country.toLowerCase()}.geojson`;
  d3.json(url, function (error, mapData) {
    const features = mapData.features;
    const center = d3.geo.centroid(mapData);
    let scale = 150;
    let offset = [width / 2, height / 2];
    let projection = d3.geo.mercator().scale(scale).center(center)
      .translate(offset);

    path = path.projection(projection);

    const bounds = path.bounds(mapData);
    const hscale = scale * width / (bounds[1][0] - bounds[0][0]);
    const vscale = scale * height / (bounds[1][1] - bounds[0][1]);
    scale = (hscale < vscale) ? hscale : vscale;
    const offsetWidth = width - (bounds[0][0] + bounds[1][0]) / 2;
    const offsetHeigth = height - (bounds[0][1] + bounds[1][1]) / 2;
    offset = [offsetWidth, offsetHeigth];
    projection = d3.geo.mercator()
      .center(center)
      .scale(scale)
      .translate(offset);
    path = path.projection(projection);

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
  });
  // container.show();
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
