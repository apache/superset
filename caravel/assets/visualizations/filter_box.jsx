// JS
const $ = window.$ = require('jquery');
const d3 = window.d3 || require('d3');

import React from 'react';
import ReactDOM from 'react-dom';

import Select from 'react-select';
import 'react-select/dist/react-select.css';

import './filter_box.css';

function filterBox(slice) {
  const filtersObj = {};
  const d3token = d3.select(slice.selector);

  const refresh = function () {
    d3token.selectAll('*').remove();
    const container = d3token
      .append('div')
      .classed('padded', true);
    const preSelectDict = slice.getFilters() || {};

    // filter box should ignore the dashboard's filters
    const url = slice.jsonEndpoint({ extraFilters: false});
    $.getJSON(url, (payload) => {
      let timeFilter;
      const maxes = {};
      const filters = Object.keys(payload.data).map((filter) => {
        const data = payload.data[filter];
        maxes[filter] = d3.max(data, function (d) {
          return d.metric;
        });
        const id = 'fltbox__' + filter;
        return (
          <div>
            {filter}
            <Select
              placeholder={`Select [${filter}]`}
              multi={true}
              options={data.map((opt) => {
                const perc = Math.round((opt.metric / maxes[opt.filter]) * 100);
                let style = (
                  'padding: 2px 5px;' +
                  'background-image: linear-gradient(to right, lightgrey, ' +
                  `lightgrey ${perc}%, rgba(0,0,0,0) ${perc}%`
                );
                //return '<div style="' + style + '"><span>' + opt.text + '</span></div>';
                return { value: opt.id, label: <div>{opt.id}</div> };
              })}
              onChange={(selectedOptions) => {
                const vals = selectedOptions.map((opt) => opt.value);
                slice.setFilter(filter, vals);
              }}
            />
          </div>
        );

        const preSelect = preSelectDict[filter];
        if (preSelect !== undefined) {
          filtersObj[filter].select2('val', preSelect);
        }
      });
      ReactDOM.render((
        <div>
          {timeFilter}
          {filters}
        </div>
      ), document.getElementById(slice.containerId));
      slice.done(payload);
    })
    .fail(function (xhr) {
      slice.error(xhr.responseText, xhr);
    });
  };
  return {
    render: refresh,
    resize: () => {},
  };
}

module.exports = filterBox;
