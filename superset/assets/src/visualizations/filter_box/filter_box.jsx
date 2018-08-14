import d3 from 'd3';
import React from 'react';
import ReactDOM from 'react-dom';

import FilterBox from './FilterBox';

function filterBox(slice, payload) {
  const d3token = d3.select(slice.selector);
  d3token.selectAll('*').remove();

  const fd = slice.formData;
  const filtersChoices = {};
  // Making sure the ordering of the fields matches the setting in the
  // dropdown as it may have been shuffled while serialized to json
  fd.groupby.forEach((f) => {
    filtersChoices[f] = payload.data[f];
  });
  ReactDOM.render(
    <FilterBox
      filtersChoices={filtersChoices}
      onChange={slice.addFilter}
      showDateFilter={fd.date_filter}
      showSqlaTimeGrain={fd.show_sqla_time_granularity}
      showSqlaTimeColumn={fd.show_sqla_time_column}
      showDruidTimeGrain={fd.show_druid_time_granularity}
      showDruidTimeOrigin={fd.show_druid_time_origin}
      datasource={slice.datasource}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={fd.instant_filtering}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = filterBox;
