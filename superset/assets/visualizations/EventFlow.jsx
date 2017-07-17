import React from 'react';
import ReactDOM from 'react-dom';

import {
  App,
  withParentSize,
  cleanEvents,
  TS,
  EVENT_NAME,
  ENTITY_ID,
} from '@data-ui/event-flow';

/*
 * This function takes the slice object and json payload as input and renders a
 * responsive <EventFlow /> component using the json data.
 */
function renderEventFlow(slice, json) {
  const container = document.querySelector(slice.selector);
  const hasData = json.data && json.data.length > 0;

  // the slice container overflows ~80px in explorer, so we have to correct for this
  const isExplorer = (/explore/).test(window.location.pathname);

  const ResponsiveVis = withParentSize(({
    parentWidth,
    parentHeight,
    ...rest
  }) => (
    <App
      width={parentWidth}
      height={parentHeight - (isExplorer ? 80 : 0)}
      {...rest}
    />
  ));

  // render the component if we have data, otherwise render a no-data message
  let Component;
  if (hasData) {
    const userKey = json.form_data.entity;
    const eventNameKey = json.form_data.all_columns_x;

    // map from the Superset form fields to <EventFlow />'s expected data keys
    const accessorFunctions = {
      [TS]: datum => new Date(datum.__timestamp), // eslint-disable-line no-underscore-dangle
      [EVENT_NAME]: datum => datum[eventNameKey],
      [ENTITY_ID]: datum => String(datum[userKey]),
    };

    const dirtyData = json.data;
    const cleanData = cleanEvents(dirtyData, accessorFunctions);
    const minEventCount = slice.formData.min_leaf_node_event_count;

    Component = <ResponsiveVis data={cleanData} initialMinEventCount={minEventCount} />;
  } else {
    Component = <div>Sorry, there appears to be no data</div>;
  }

  ReactDOM.render(Component, container);
}

module.exports = renderEventFlow;
