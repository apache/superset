import d3 from 'd3';
import PropTypes from 'prop-types';
import Datamap from 'datamaps/dist/datamaps.world.min';
import './WorldMap.css';

const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    country: PropTypes.string,
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    name: PropTypes.string,
    m1: PropTypes.number,
    m2: PropTypes.number,
  })),
  height: PropTypes.number,
  maxBubbleSize: PropTypes.number,
  showBubbles: PropTypes.bool,
};

const formatter = d3.format('.3s');

function WorldMap(element, props) {
  const {
    data,
    height,
    maxBubbleSize,
    showBubbles,
  } = props;

  const div = d3.select(element);

  const container = element;
  container.style.height = `${height}px`;
  div.selectAll('*').remove();

  // Ignore XXX's to get better normalization
  const filteredData = data.filter(d => (d.country && d.country !== 'XXX'));

  const ext = d3.extent(filteredData, d => d.m1);
  const extRadius = d3.extent(filteredData, d => d.m2);
  const radiusScale = d3.scale.linear()
    .domain([extRadius[0], extRadius[1]])
    .range([1, maxBubbleSize]);

  const colorScale = d3.scale.linear()
    .domain([ext[0], ext[1]])
    .range(['#FFF', 'black']);

  const processedData = filteredData.map(d => ({
    ...d,
    radius: radiusScale(d.m2),
    fillColor: colorScale(d.m1),
  }));

  const mapData = {};
  processedData.forEach((d) => {
    mapData[d.country] = d;
  });

  const map = new Datamap({
    element,
    data: processedData,
    fills: {
      defaultFill: '#ddd',
    },
    geographyConfig: {
      popupOnHover: true,
      highlightOnHover: true,
      borderWidth: 1,
      borderColor: '#fff',
      highlightBorderColor: '#fff',
      highlightFillColor: '#005a63',
      highlightBorderWidth: 1,
      popupTemplate: (geo, d) => (
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m1)}</div>`
      ),
    },
    bubblesConfig: {
      borderWidth: 1,
      borderOpacity: 1,
      borderColor: '#005a63',
      popupOnHover: true,
      radius: null,
      popupTemplate: (geo, d) => (
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m2)}</div>`
      ),
      fillOpacity: 0.5,
      animate: true,
      highlightOnHover: true,
      highlightFillColor: '#005a63',
      highlightBorderColor: 'black',
      highlightBorderWidth: 2,
      highlightBorderOpacity: 1,
      highlightFillOpacity: 0.85,
      exitDelay: 100,
      key: JSON.stringify,
    },
  });

  map.updateChoropleth(mapData);

  if (showBubbles) {
    map.bubbles(processedData);
    div.selectAll('circle.datamaps-bubble').style('fill', '#005a63');
  }
}

WorldMap.displayName = 'WorldMap';
WorldMap.propTypes = propTypes;

export default WorldMap;
