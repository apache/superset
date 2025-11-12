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
import d3 from 'd3';
import PropTypes from 'prop-types';
import { extent as d3Extent } from 'd3-array';
import { topology } from 'topojson-server';
import {
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import Datamap from 'datamaps/dist/datamaps.all.min';
import countries, { countryOptions } from './countries';

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      country_id: PropTypes.string,
      metric: PropTypes.number,
    }),
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  country: PropTypes.string,
  colorScheme: PropTypes.string,
  linearColorScheme: PropTypes.string,
  mapBaseUrl: PropTypes.string,
  numberFormat: PropTypes.string,
};

const maps = {};

function CountryMap(element, props) {
  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    colorScheme,
    sliceId,
  } = props;

  const container = element;
  const linearColorScale = getSequentialSchemeRegistry()
    .get(linearColorScheme)
    .createLinearScale(d3Extent(data, v => v.metric));
  const colorScale = CategoricalColorNamespace.getScale(colorScheme);

  const colorMap = {};
  data.forEach(d => {
    colorMap[d.country_id] = colorScheme
      ? colorScale(d.country_id, sliceId)
      : linearColorScale(d.metric);
  });

  const div = d3.select(container);
  div.classed('superset-legacy-chart-country-map', true);
  div.selectAll('*').remove();

  let mapJson = maps[country];
  if (!mapJson) {
    const url = countries[country];
    d3.json(url, (error, geoJsonData) => {
      if (error) {
        const countryName =
          countryOptions.find(x => x[0] === country)?.[1] || country;
        d3.select(element).html(
          `<div class="alert alert-danger">Could not load map data for ${countryName}</div>`,
        );
        return;
      }

      const topoJsonData = topology(geoJsonData);
      console.info('geoJsonData', geoJsonData);
      console.info('topoJsonData', topoJsonData);
      maps[country] = topoJsonData;
      mapJson = topoJsonData;
    });
  }

  Datamap({
    element,
    width,
    height,
    scope: 'custom',
    geographyConfig: {
      dataJson: mapJson,
    },
    setProjection: element => {
      const center = d3.geo.centroid(element);
      const scale = 100;

      const projection = d3.geo
        .mercator()
        .scale(scale)
        .center(center)
        .translate([width / 2, height / 2]);

      const path = d3.geo.path().projection(projection);

      return { path, projection };
    },
  });
}

CountryMap.displayName = 'CountryMap';
CountryMap.propTypes = propTypes;

export default CountryMap;
