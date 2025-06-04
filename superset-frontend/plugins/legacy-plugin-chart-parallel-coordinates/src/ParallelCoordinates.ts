/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable react/sort-prop-types */
// @ts-expect-error TS(7016): Could not find a declaration file for module 'd3v3... Remove this comment to see the full error message
import * as d3 from 'd3v3';
import PropTypes from 'prop-types';
import { getSequentialSchemeRegistry } from '@superset-ui/core';

import parcoords from './vendor/parcoords/d3.parcoords';
import divgrid from './vendor/parcoords/divgrid';

const propTypes = {
  // Standard tabular data [{ fieldName1: value1, fieldName2: value2 }]
  data: PropTypes.arrayOf(PropTypes.object),
  width: PropTypes.number,
  height: PropTypes.number,
  colorMetric: PropTypes.string,
  includeSeries: PropTypes.bool,
  linearColorScheme: PropTypes.string,
  metrics: PropTypes.arrayOf(PropTypes.string),
  series: PropTypes.string,
  showDatatable: PropTypes.bool,
};

function ParallelCoordinates(element: $TSFixMe, props: $TSFixMe) {
  const {
    data,
    width,
    height,
    colorMetric,
    includeSeries,
    linearColorScheme,
    metrics,
    series,
    showDatatable,
  } = props;

  const cols = includeSeries ? [series].concat(metrics) : metrics;

  const ttypes = {};
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  ttypes[series] = 'string';
  metrics.forEach((v: $TSFixMe) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ttypes[v] = 'number';
  });

  const colorScale = colorMetric
    ? // @ts-expect-error TS(2532): Object is possibly 'undefined'.
      getSequentialSchemeRegistry()
        .get(linearColorScheme)
        .createLinearScale(d3.extent(data, (d: $TSFixMe) => d[colorMetric]))
    : () => 'grey';
  const color = (d: $TSFixMe) => colorScale(d[colorMetric]);
  const container = d3
    .select(element)
    .classed('superset-legacy-chart-parallel-coordinates', true);
  container.selectAll('*').remove();
  const effHeight = showDatatable ? height / 2 : height;

  const div = container
    .append('div')
    .style('height', `${effHeight}px`)
    .classed('parcoords', true);

  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
  const chart = parcoords()(div.node())
    // @ts-expect-error TS(2339): Property 'width' does not exist on type '(selectio... Remove this comment to see the full error message
    .width(width)
    .color(color)
    .alpha(0.5)
    .composite('darken')
    .height(effHeight)
    .data(data)
    .dimensions(cols)
    .types(ttypes)
    .render()
    .createAxes()
    .shadows()
    .reorderable()
    .brushMode('1D-axes');

  if (showDatatable) {
    // create data table, row hover highlighting
    // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
    const grid = divgrid();
    container
      .append('div')
      .style('height', `${effHeight}px`)
      .datum(data)
      .call(grid)
      .classed('parcoords grid', true)
      .selectAll('.row')
      .on({
        mouseover(d: $TSFixMe) {
          chart.highlight([d]);
        },
        mouseout: chart.unhighlight,
      });
    // update data table on brush event
    chart.on('brush', (d: $TSFixMe) => {
      d3.select('.grid')
        .datum(d)
        .call(grid)
        .selectAll('.row')
        .on({
          mouseover(dd: $TSFixMe) {
            chart.highlight([dd]);
          },
          mouseout: chart.unhighlight,
        });
    });
  }
}

ParallelCoordinates.displayName = 'ParallelCoordinates';
ParallelCoordinates.propTypes = propTypes;

export default ParallelCoordinates;
