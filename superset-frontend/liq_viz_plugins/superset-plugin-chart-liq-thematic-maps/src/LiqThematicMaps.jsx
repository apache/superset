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
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl-compare/dist/mapbox-gl-compare.css';

import { SupersetClient } from '@superset-ui/core';

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
  const mapL = useRef(null);
  const mapR = useRef(null);
  const compareMap = useRef(null);

  const [compareProps, setCompareProps] = useState({});
  const [compareData, setCompareData] = useState([]);
  const [transformedProps, setTransformedProps] = useState({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState(<></>);
  const [drawerTitle, setDrawerTitle] = useState('');

  const [isSecondMap, setIsSecondMap] = useState(compareChart && (typeof compareChart === 'number' || typeof compareChart === 'string'));
  const [loadSecondMap, setLoadSecondMap] = useState(false);
  const [cmapLoaded, setCmapLoaded] = useState({ left: false, right: false });

  const [mapsLoaded, setMapsLoaded] = useState({ left: false, right: false });

  const [items, setItems] = useState([]);

  const [mapVis, setMapVis] = useState('left');

  /*
    Loading Logic:
    - Wait for all maps color maps to be loaded if they are thematic
    - If there is a compare map, wait for both compareData and transformedProps to be loaded
    - If there is a compare map:
      - We wait for second map compareData and transformedProps to be loaded
      - If either map 
  */

  useEffect(() => {
    console.log(mapVis);
    if (isSecondMap && !mapsLoaded.left && !mapsLoaded.right) return;
    if (!mapsLoaded.left) return;
    setItems([
      {
        icon: <PlusOutlined />,
        label: 'Menu',
        key: 'menu',
        children: [
          features.includes('legend') && 
          {
            icon: <BarsOutlined />,
            label: <span>Legend</span>,
            key: '1',
            onClick: () => {
              let legendProps = [];
              const mapMap = { left: mapL, right: mapR };
              const maps = isSecondMap ? 
                mapVis === 'both' ?
                  ['left', 'right']
                :
                  mapVis === 'left' ?
                    ['left']
                  :
                    ['right']
              : 
                ['left'];
              maps.map(map => {
                let reverseMap = {};
                const cmap = mapMap[map].current ? mapMap[map].current.getCMap() : {};
                Object.keys(cmap).map(x => {
                  if (cmap[x] in reverseMap) {
                    reverseMap[cmap[x]].push(x);
                  } else {
                    reverseMap[cmap[x]] = [x];
                  }
                });
                const parentProps = map === 'left' ? props : transformedProps;
                legendProps.push({
                  intranetLayers: parentProps.intranetLayers,
                  tradeAreas: parentProps.tradeAreas,
                  thematicData: mapMap[map].current ? mapMap[map].current.getThematicLegend() : {},
                  taSectorSA1Map: parentProps.taSectorSA1Map,
                  taSectorColorMap: parentProps.taSectorColorMap,
                  colorMap: reverseMap,
                  thematicCol: parentProps.metricCol,
                  groupCol: parentProps.groupCol,
                  map: mapMap[map].current.getMap()
                });
              })
              setDrawerTitle('Map Legend');
              setDrawerContent(
                <>
                  {legendProps.map((props, i) => (
                    props.map &&
                    <div key={i}>
                      {legendProps.length == 2 && i == 0 && (<h3>Left</h3>)}
                      {legendProps.length == 2 && i == 1 && (<h3>Right</h3>)}
                      <Legend key={i} {...props} />
                    </div>
                  ))}
                </>
              );
              setDrawerOpen(true);
            }
          },
          features.includes('radius') && {
            icon: <RadiusSettingOutlined />,
            label: <span>Radius</span>,
            key: '2',
            onClick: () => {
              setDrawerTitle('Radius Settings');
              setDrawerContent(
                <Radius 
                  maps={isSecondMap ? [mapL.current.getMap(), mapR.current.getMap()] : [mapL.current.getMap()]} 
                  groupCol={groupCol} 
                  boundary={boundary}
                  radiusColor={newRadiusColor}
                  radiusThreshold={radiusThreshold}
                  borderColor={newRadiusBorderColor}
                  borderWidth={radiusBorderWidth} 
                  radiusLinkedCharts={newRadiusLinkedCharts}
                  sa1Color={newIntersectSa1Color}
                  sa1Width={intersectSa1Width}
                />
              );
              setDrawerOpen(true);
            }
          },
          features.includes('drivetime') && {
            icon: <CarOutlined />,
            label: <span>Drivetime</span>,
            key: '3',
            onClick: () => {
              setDrawerTitle('Drivetime Settings');
              setDrawerContent(
                <Drivetime 
                maps={isSecondMap ? [mapL.current.getMap(), mapR.current.getMap()] : [mapL.current.getMap()]}
                  groupCol={groupCol}
                  boundary={boundary}
                  drivetimeColor={newDrivetimeColor}
                  drivetimeThreshold={drivetimeThreshold}
                  borderColor={newDrivetimeBorderColor}
                  borderWidth={drivetimeBorderWidth}
                  drivetimeLinkedCharts={newDrivetimeLinkedCharts}
                  sa1Color={newIntersectSa1Color}
                  sa1Width={intersectSa1Width}
                />
              );
              setDrawerOpen(true);
            }
          }
        ]
      }
    ])
  }, [mapsLoaded, compareChart, mapVis]);

  // If there is a compare chart, load its initial props and data and store in state
  useEffect(() => {
    setIsSecondMap(compareChart && (typeof compareChart === 'number' || typeof compareChart === 'string'));
    if (!(compareChart && (typeof compareChart === 'number' || typeof compareChart === 'string'))) return;
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
  }, [compareChart, data]);

  // Apply transform props to initial right map props when they are received
  useEffect(() => {
    if (Object.keys(compareProps).length > 0 && compareData.length > 0) {
      const propsToCamel = _.mapKeys(compareProps, (v, k) => _.camelCase(k));
      const newProps = transformProps( {width: width, height: height, formData: propsToCamel, queriesData: [{ data: compareData }]})
      setTransformedProps(
        // overriding settings below to keep them consistent
        // discuss whether to keep radius, drivetime and intersecting SA1s consistent for both maps
        {
          ...newProps, 
          width: width, 
          height: height,
          newRadiusColor: newRadiusColor,
          newRadiusBorderColor: newRadiusBorderColor,
          radiusBorderWidth: radiusBorderWidth,
          radiusThreshold: radiusThreshold,
          newRadiusLinkedCharts: newRadiusLinkedCharts,
          newDrivetimeColor: newDrivetimeColor,
          newDrivetimeBorderColor: newDrivetimeBorderColor,
          drivetimeBorderWidth: drivetimeBorderWidth,
          drivetimeThreshold: drivetimeThreshold,
          newDrivetimeLinkedCharts: newDrivetimeLinkedCharts,
          newIntersectSa1Color: newIntersectSa1Color,
          intersectSa1Width: intersectSa1Width
        }
      );
      setLoadSecondMap(true);
    }
  }, [compareProps, compareData]);

  const slideHandler = (e) => {
    const slidePos = e.currentPosition;
    const offset = 10
    if (slidePos <= offset) {
      setMapVis('right');
    } else if (slidePos >= width - offset) {
      setMapVis('left');
    } else {
      setMapVis('both');
    }
  }

  // Instantiate compare map only when transformed props are ready for the right map
  useEffect(() => {
    if (Object.keys(transformedProps).length > 0 && compareData.length > 0) {
      compareMap.current = new MapboxCompare(mapL.current.getMap(), mapR.current.getMap(), '#comparison-container', {
        mousemove: false,
        orientation: 'vertical'
      });
      compareMap.current.setSlider(width);
      compareMap.current.on('slideend', slideHandler);
    }
  }, [transformedProps, compareData]);

  const instigateReload = () => {
    setLoadSecondMap(false);
    setTransformedProps({});
    setCompareProps({});
    setCompareData([]);
    compareMap.current.remove();
    compareMap.current = null;
  }

  // Destroy maps on data
  useEffect(() => {
    if (compareMap.current) instigateReload();
  }, [data]);

  // Check if only one map is visible and if so which one is it or both are visible
  useEffect(() => {
    if (!compareMap.current) return;
    compareMap.current.off('slideend', slideHandler);
    compareMap.current.on('slideend', slideHandler);
  }, [mapVis]);

  return (
    <>
      <Menu 
        mode='horizontal' 
        style={{
          position: 'absolute',
          zIndex: 100,
          top: '5px',
          left: '5px',
          opacity: '80%'
        }}
      >
        {items.map(i => (
          i.children && i.children.length > 0 ?
            <SubMenu 
              title={<span>{i.icon}{i.label}</span>} style={{ opacity: '80%' }}
              key='subMenu'
            >
              {i.children.map(c => (
                c && <Menu.Item
                  key={c.key} 
                  onClick={c.onClick ? c.onClick : () => {}} 
                  //disabled={Object.keys(colorMap).length === 0 && mapType.includes('thematic')}
                  style={{ opacity: '80%' }}
                >
                  {c.icon}
                  {c.label}
                </Menu.Item>
              ))}
            </SubMenu>
          :
            i && <Menu.Item 
              key={i.key} 
              onClick={i.onClick ? i.onClick : () => {}} 
              //disabled={Object.keys(colorMap).length === 0 && mapType.includes('thematic')}
              style={{ opacity: '80%' }}
            >
              {i.icon}
              {i.label}
            </Menu.Item>
        ))}
      </Menu>
      <div style={{ 
          height: height, 
          width: '100%', 
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0 
        }} 
        ref={rootElem} 
        id={
          isSecondMap ?
            'comparison-container'
          :
            'map-container'
        }
      >
        {(!isSecondMap && (mapType.includes('thematic') ? cmapLoaded.left : mapsLoaded.left)) || 
        (isSecondMap && loadSecondMap) && (
          <Map 
            {...{
              ...props, 
              mapID: 'left', 
              setDrawerOpen, 
              setDrawerContent,
              setDrawerTitle,
              setCmapLoaded: (v) => {setCmapLoaded({...cmapLoaded, left: v})},
              setMapLoaded: (v) => {setMapsLoaded({...mapsLoaded, left: v})},
              load: true
            }} 
            ref={mapL} 
          />
        )}
        {isSecondMap && loadSecondMap && (
          <Map 
            {...{
              ...transformedProps, 
              mapID: 'right', 
              setDrawerOpen,
              setDrawerContent, 
              setDrawerTitle,
              setCmapLoaded: (v) => {setCmapLoaded({...cmapLoaded, right: v})},
              setMapLoaded: (v) => {setMapsLoaded({...mapsLoaded, right: v})},
              load: loadSecondMap
            }} 
            width={width}
            height={height}
            ref={mapR}
          />
        )}
        <SideDrawer 
          drawerTitle={drawerTitle}
          drawerContent={drawerContent}
          open={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          width={width}
        />
      </div>
    </>
  ); 
}