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
import React, { useEffect, createRef, useRef, useState, useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { LiqThematicMapsProps, LiqThematicMapsStylesProps } from './types';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = "pk.eyJ1IjoiZGtpciIsImEiOiJjazIxNW54azgxZzd6M25xb2RqNHk0Z2Z5In0.1SbfSydEBGdjIxU-Wy0EXA"

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<LiqThematicMapsStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

const BDRY_LAYER_MAP = {
  "dkir.d4pc0v1s": "all_sa1s",
  "dkir.1oqr7ii3": "SA3_Demographic_Data2-0f718v"
}

export default function LiqThematicMaps(props: LiqThematicMapsProps) {
  const { 
    data,
    groupCol,
    height, 
    width, 
    boundary, 
    colorMap
  } = props;

  const rootElem = createRef<HTMLDivElement>();

  const mapContainer = useRef(null);
  const map = useRef(null);

  const [currIDs, setCurrIDs] = useState([]);

  useEffect(() => {
    if (!map.current) return;
    map.current.resize();
  }, [width, height])


  useEffect(() => {
    if (map.current) {
      map.current.remove();
      map.current = null;
    } 
  }, [data])

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v10',
      center: [151.2, -33.8],
      zoom: 9,
      minZoom: 7
    });

    map.current.on('load', () => {

      console.log(colorMap);

      map.current.addSource('tileset', {
        'type': 'vector',
        'url': `mapbox://${boundary}`
      });

      map.current.addLayer({
        'id': 'tileset',
        'type': 'fill',
        'source': 'tileset',
        'source-layer': BDRY_LAYER_MAP[boundary],
        'layout': {},
        'paint': {
          'fill-color': 'transparent',
          'fill-outline-color': '#2E2EFF',
          'fill-opacity': 0.7
        }
      });
      
    });

    map.current.on('data', () => {
      const features = map.current.querySourceFeatures('tileset', {
        sourceLayer: BDRY_LAYER_MAP[boundary]
       });

       let ids = [];
       for (const d in features) {
        ids.push({
          id: features[d].id,
          col: features[d].properties[groupCol]
        });
       }
       setCurrIDs([...ids]);
    });

  });

  useEffect(() => {
    if (currIDs.length == 0) return;
    for (const i in currIDs) {
      map.current.setFeatureState(
        {
          source: 'tileset', 
          sourceLayer: BDRY_LAYER_MAP[boundary], 
          id: currIDs[i].id
        },
        {
          color: colorMap[currIDs[i].col]
        }
      );
    }
    map.current.setPaintProperty('tileset', 'fill-color', ['feature-state', 'color']);
  }, [currIDs]);

  return (
    <Styles
      ref={rootElem}
      height={height}
      width={width}
    >
      <div 
        ref={mapContainer} 
        className="map-container" 
        style={{height: height, width: width}}
      />
    </Styles>
  );  
}
