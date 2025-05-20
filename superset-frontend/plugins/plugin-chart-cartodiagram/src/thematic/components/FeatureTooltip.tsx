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
import { styled } from '@superset-ui/core';
import React, { useEffect } from 'react';
import { Feature, MapBrowserEvent } from 'ol';
import { Pixel } from 'ol/pixel';
import Handlebars from 'handlebars';
import { FeatureTooltipProps } from '../types';

export const FeatureTooltip = (props: FeatureTooltipProps) => {
  const { className, olMap, tooltipTemplate, showTooltip, dataLayers } = props;

  const infoTooltip = document.getElementById('infoTooltip');

  useEffect(() => {
    let currentFeature: Feature | undefined;
    const displayFeatureInfo = (pixel: Pixel, evt: MapBrowserEvent<any>) => {
      if (!infoTooltip) {
        return;
      }
      const { clientX, clientY, target, view } = evt.originalEvent;
      const { innerHeight, innerWidth } = view;

      const feature = target.closest('.ol-control')
        ? undefined
        : olMap.forEachFeatureAtPixel(pixel, feat => feat as Feature, {
            layerFilter: layer =>
              dataLayers
                ? dataLayers.some(dataLayer => dataLayer === layer)
                : false,
          });

      if (feature) {
        if (feature !== currentFeature) {
          infoTooltip.style.visibility = 'visible';
          const template = Handlebars.compile(tooltipTemplate);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { geometry, ...templateProps } = feature.getProperties();
          const result = template(templateProps);
          infoTooltip.innerHTML = result;
        }
        const { offsetHeight, offsetWidth } = infoTooltip;
        let tooltipY = clientY;
        let tooltipX = clientX;
        // check if tooltip will float over screen bottom
        if (clientY + offsetHeight >= innerHeight) {
          tooltipY = clientY - offsetHeight;
        }
        // check if tooltip will float over screen right
        if (clientX + offsetWidth >= innerWidth) {
          const tooltipCssOffset = 10;
          tooltipX = clientX - offsetWidth - tooltipCssOffset;
        }
        infoTooltip.style.left = `${tooltipX}px`;
        infoTooltip.style.top = `${tooltipY}px`;
      } else {
        infoTooltip.style.visibility = 'hidden';
        infoTooltip.innerHTML = '';
      }
      currentFeature = feature;
    };

    const pointerMove = (evt: MapBrowserEvent<any>) => {
      if (tooltipTemplate !== '') {
        if (evt.dragging && infoTooltip) {
          infoTooltip.style.visibility = 'hidden';
          currentFeature = undefined;
          infoTooltip.innerHTML = '';
          return;
        }
        const pixel = olMap.getEventPixel(evt.originalEvent);
        displayFeatureInfo(pixel, evt);
      }
    };

    if (showTooltip) {
      olMap.on('pointermove', pointerMove);
    }

    return () => {
      if (showTooltip) {
        olMap.un('pointermove', pointerMove);
      }
    };
  }, [infoTooltip, olMap, tooltipTemplate, showTooltip, dataLayers]);

  return <div id="infoTooltip" className={className} />;
};

// eslint-disable-next-line theme-colors/no-literal-colors
export const StyledFeatureTooltip = styled(FeatureTooltip)`
  position: fixed;
  display: inline-block;
  height: auto;
  width: auto;
  z-index: 100;
  background-color: #333;
  color: #fff;
  text-align: left;
  border-radius: 4px;
  padding: 5px;
  transform: translateX(10px);
  visibility: hidden;
  pointer-events: none;
`;
