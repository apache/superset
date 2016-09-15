// JS
const d3 = require('d3');
const Datamap = require('datamaps');

// CSS
require('./world_map.css');

function worldMapChart(slice) {
  const render = function () {
    const container = slice.container;
    const div = d3.select(slice.selector);

    container.css('height', slice.height());

    d3.json(slice.jsonEndpoint(), function (error, json) {
      div.selectAll('*').remove();
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }
      const fd = json.form_data;
      // Ignore XXX's to get better normalization
      let data = json.data.filter((d) => (d.country && d.country !== 'XXX'));

      const ext = d3.extent(data, function (d) {
        return d.m1;
      });
      const extRadius = d3.extent(data, function (d) {
        return d.m2;
      });
      const radiusScale = d3.scale.linear()
        .domain([extRadius[0], extRadius[1]])
        .range([1, fd.max_bubble_size]);

      const colorScale = d3.scale.linear()
        .domain([ext[0], ext[1]])
        .range(['#FFF', 'black']);

      data = data.map((d) => Object.assign({}, d, {
        radius: radiusScale(d.m2),
        fillColor: colorScale(d.m1),
      }));

      const mapData = {};
      data.forEach((d) => {
        mapData[d.country] = d;
      });

      const f = d3.format('.3s');

      container.show();

      const map = new Datamap({
        element: slice.container.get(0),
        data,
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
            `<div class="hoverinfo"><strong>${d.name}</strong><br>${f(d.m1)}</div>`
          ),
        },
        bubblesConfig: {
          borderWidth: 1,
          borderOpacity: 1,
          borderColor: '#005a63',
          popupOnHover: true,
          radius: null,
          popupTemplate: (geo, d) => (
            `<div class="hoverinfo"><strong>${d.name}</strong><br>${f(d.m2)}</div>`
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

      if (fd.show_bubbles) {
        map.bubbles(data);
        div.selectAll('circle.datamaps-bubble').style('fill', '#005a63');
      }
      slice.done(json);
    });
  };

  return { render, resize: render };
}

module.exports = worldMapChart;
