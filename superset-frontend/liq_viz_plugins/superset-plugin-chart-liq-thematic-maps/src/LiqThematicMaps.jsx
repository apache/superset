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
import React, { useEffect, createRef, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxCompare from 'mapbox-gl-compare';
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl-compare/dist/mapbox-gl-compare.css';
import { getSequentialSchemeRegistry } from '@superset-ui/core';

import { SupersetClient } from '@superset-ui/core';

import entity from '../../liq_data/entity.json';

import _ from 'lodash';

// UI imports
import {
  BarsOutlined,
  RadiusSettingOutlined,
  CarOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';

// Component imports
import SideDrawer from './components/SideDrawer.js';
import Legend from './components/Legend.js';
import Radius from './components/Radius.js';
import DataDisplay from './components/DataDisplay.js';
import Drivetime from './components/Drivetime.js';
import Map from './components/Map.js';

import transformProps from './plugin/transformProps.js';


const { Content } = Layout;
const { SubMenu } = Menu;

const defaults = require('./defaultLayerStyles.js');

const iconsSVG = require('./iconSVG.js');

const liqSecrets = require('../../liq_secrets.js').liqSecrets;
const layerStyles = defaults.defaultLayerStyles;
const iconExprs = defaults.iconExprs;

mapboxgl.accessToken = liqSecrets.mapbox.accessToken;

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function LiqThematicMaps(props) {
  const { 
    data, // from databricks/other databases
    groupCol, // index col i.e. SA1 code, entity_id, etc.
    metricCol, // thematic col i.e. Population, a calculated column, GLA, etc.
    height, 
    width, 
    mapType, // type of map, can be one or more of thematic, trade_area and intranet
    mapStyle, // Mapbox "base map" style, i.e. Streets, Light, etc.
    boundary, // boundary layer for the map, i.e. SA1, POA, etc.
    intranetLayers, // list of intranet layers, i.e. shopping centres, supermarkets, etc.
    features, // list of features to include in map
    linearColorScheme, // color palette for thematic
    breaksMode, // how to break up data
    customMode, // if breaksMode is "custom", user defined breaks 
    numClasses, // number of classes for breaks, i.e. number of ranges
    opacity, // opacity value for thematic
    tradeAreas, // trade area data if any
    tradeAreaSA1s, // trade area SA1 data
    taSectorSA1Map, // for each centre trade area sector, list of constituent SA1s
    taSectorColorMap, // for each centre trade area, map from sector to colour
    taSectorCentroids, // geojson file for sector centroid points, used to label them in a symbol layer
    intranetData, // data relating to intranet layers
    latitude, // starting lat
    longitude, // starting lng
    zoom, // starting zoom
    taLoc, // location of primary sector centroid of first TA
    newRadiusColor, // color of radius in rgba
    radiusThreshold, // intersection area threshold for radius
    newRadiusBorderColor, // color of radius border in rgba
    radiusBorderWidth, // stroke width of radius border
    newRadiusLinkedCharts, // chart ids to update in dashboard when radius is updated
    newDrivetimeColor, // color of drivetime in rgba
    drivetimeThreshold, // intersection area threshold for drivetime
    newDrivetimeBorderColor, // color of drivetime border in rgba
    drivetimeBorderWidth, // stroke width of drivetime border
    newDrivetimeLinkedCharts, // chart ids to update in dashboard when drivetime is updated
    newIntersectSa1Color,
    intersectSa1Width,
    compareChart
  } = props;

  const rootElem = createRef();
  const map = useRef(null);
  const compareMap = useRef(null);

  const [compareProps, setCompareProps] = useState({});
  const [compareData, setCompareData] = useState([]);
  const [transformedProps, setTransformedProps] = useState({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadSecondMap, setLoadSecondMap] = useState(false);

  useEffect(() => {

    SupersetClient.get({ endpoint: `/api/v1/chart/${compareChart}` })
      .then(res => {
        if ('result' in res.json) {
          setCompareProps(JSON.parse(res.json.result.params));
          SupersetClient.get({ endpoint: `/api/v1/chart/${compareChart}/data` })
            .then(res => {
              if ('result' in res.json) setCompareData(res.json.result[0].data);
            });
        }
      });
  }, [compareChart]);

  useEffect(() => {
    if (Object.keys(compareProps).length > 0 && compareData.length > 0) {
      const propsToCamel = _.mapKeys(compareProps, (v, k) => _.camelCase(k));
      const newProps = transformProps( {width: width, height: height, formData: propsToCamel, queriesData: [{ data: compareData }]})
      setTransformedProps({...newProps});
      setLoadSecondMap(true);
    }
  }, [compareProps, compareData]);

  return (
    <div style={{height: height, width: width}} ref={rootElem} id='compare-container'>
      <Map {...{...props, mapID: 'mapID', setDrawerOpen}} ref={map} />
    </div>
  ); 
}