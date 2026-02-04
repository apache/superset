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

import { ColumnMeta } from '@superset-ui/chart-controls';
import Handlebars from 'handlebars';
import { Map } from 'ol';
import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import { Pixel } from 'ol/pixel';
import VectorSource from 'ol/source/Vector';

export const setTooltipInvisible = (tooltip: HTMLDivElement) => {
  // eslint-disable-next-line no-param-reassign
  tooltip.style.visibility = 'hidden';
};

export const setTooltipVisible = (tooltip: HTMLDivElement) => {
  // eslint-disable-next-line no-param-reassign
  tooltip.style.visibility = 'visible';
};

export const clearTooltip = (tooltip: HTMLDivElement) => {
  // eslint-disable-next-line no-param-reassign
  tooltip.innerHTML = '';
};

export const renderTooltip = (
  template: string,
  props: Record<string, any>,
  tooltip: HTMLDivElement,
) => {
  const renderedTemplate = Handlebars.compile(template);
  const result = renderedTemplate(props);
  // eslint-disable-next-line no-param-reassign
  tooltip.innerHTML = result;
};

export const positionTooltip = (
  tooltip: HTMLDivElement,
  clientX: number,
  clientY: number,
  innerWidth: number,
  innerHeight: number,
) => {
  const { offsetHeight, offsetWidth } = tooltip;
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
  // eslint-disable-next-line no-param-reassign
  tooltip.style.left = `${tooltipX}px`;
  // eslint-disable-next-line no-param-reassign
  tooltip.style.top = `${tooltipY}px`;
};

export const getTemplateProps = (
  feature: Feature,
  ignoredProps: string[],
  columns: ColumnMeta[],
) =>
  Object.fromEntries(
    Object.entries(feature.getProperties())
      .filter(([key]) => !ignoredProps.includes(key))
      .map(([key, value]) => {
        const column = columns.find(col => col.column_name === key);
        return [column?.verbose_name || key, value];
      }),
  );

export const getHoverFeature = (
  pixel: Pixel,
  olMap: Map,
  dataLayers: VectorLayer<VectorSource>[],
) =>
  olMap.forEachFeatureAtPixel(pixel, feat => feat as Feature, {
    layerFilter: layer => dataLayers.some(dataLayer => dataLayer === layer),
  });
