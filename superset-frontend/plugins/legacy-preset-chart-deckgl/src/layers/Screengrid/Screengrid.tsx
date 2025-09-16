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

import { ScreenGridLayer } from '@deck.gl/aggregation-layers';
import { Color } from '@deck.gl/core';
import {
  JsonObject,
  QueryFormData,
  styled,
  CategoricalColorNamespace,
  t,
} from '@superset-ui/core';
import {
  COLOR_SCHEME_TYPES,
  ColorSchemeType,
  isPointInBonds,
} from '../../utilities/utils';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps, getColorRange } from '../common';
import TooltipRow from '../../TooltipRow';
import { GetLayerType, createDeckGLComponent } from '../../factory';
import { HIGHLIGHT_COLOR_ARRAY, TRANSPARENT_COLOR_ARRAY } from '../../utils';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';

const MoreRecordsIndicator = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
`;

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

function defaultTooltipGenerator(o: JsonObject, formData: QueryFormData) {
  const metricLabel = formData.size?.label || formData.size?.value || 'Weight';
  const points = o.points || [];
  const pointCount = points.length || 0;

  return (
    <div className="deckgl-tooltip">
      {CommonTooltipRows.centroid(o)}
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Longitude and Latitude') + ': '}
        value={`${o?.coordinate?.[0]}, ${o?.coordinate?.[1]}`}
      />
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Weight') + ': '}
        value={`${o.object?.value}`}
      />
      <TooltipRow
        label={`${metricLabel}: `}
        value={`${o.object?.cellWeight}`}
      />
      <TooltipRow label="Points: " value={`${pointCount} records`} />
      {points.length > 0 && points.length <= 3 && (
        <div style={{ marginTop: 8, fontSize: '12px' }}>
          <strong>Records:</strong>
          {points.slice(0, 3).map((point: JsonObject, index: number) => (
            <div key={index} style={{ marginTop: 4, paddingLeft: '8px' }}>
              {Object.entries(point).map(([key, value]) =>
                key !== 'position' &&
                key !== 'weight' &&
                key !== '__timestamp' &&
                key !== 'points' ? (
                  <span key={key} style={{ marginRight: '8px' }}>
                    <strong>{key}:</strong> {String(value)}
                  </span>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
      {points.length > 3 && (
        <MoreRecordsIndicator>
          ... and {points.length - 3} more records
        </MoreRecordsIndicator>
      )}
    </div>
  );
}

export const getLayer: GetLayerType<ScreenGridLayer> = function ({
  formData,
  setDataMask,
  filterState,
  onContextMenu,
  payload,
  setTooltip,
  emitCrossFilters,
}) {
  const fd = formData;
  const appliedScheme = fd.color_scheme;
  const colorScale = CategoricalColorNamespace.getScale(appliedScheme);
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const colorSchemeType = fd.color_scheme_type as ColorSchemeType & 'default';
  const colorRange = getColorRange({
    defaultBreakpointsColor: fd.deafult_breakpoint_color,
    colorBreakpoints: fd.color_breakpoints,
    fixedColor: fd.color_picker,
    colorSchemeType,
    colorScale,
  });

  const aggFunc = (d: JsonObject) => d.weight || 0;

  const defaultScreenGridColorRange = [
    [255, 255, 178],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38],
  ] as Color[];

  const cellSize = fd.grid_size || 50;
  const cellToPointsMap = new Map();

  data.forEach((point: JsonObject) => {
    const { position } = point;
    if (position) {
      const cellX = Math.floor(position[0] / (cellSize * 0.01));
      const cellY = Math.floor(position[1] / (cellSize * 0.01));
      const cellKey = `${cellX},${cellY}`;

      if (!cellToPointsMap.has(cellKey)) {
        cellToPointsMap.set(cellKey, []);
      }
      cellToPointsMap.get(cellKey).push(point);
    }
  });

  const tooltipContent = createTooltipContent(fd, (o: JsonObject) =>
    defaultTooltipGenerator(o, fd),
  );

  const customOnHover = (info: JsonObject) => {
    if (info.picked) {
      const cellCenter = info.coordinate;
      const cellX = Math.floor(cellCenter[0] / (cellSize * 0.01));
      const cellY = Math.floor(cellCenter[1] / (cellSize * 0.01));
      const cellKey = `${cellX},${cellY}`;

      const pointsInCell = cellToPointsMap.get(cellKey) || [];
      const enhancedInfo = {
        ...info,
        object: {
          ...info.object,
          points: pointsInCell,
        },
      };

      setTooltip({
        content: tooltipContent(enhancedInfo),
        x: info.x,
        y: info.y,
      });
    } else {
      setTooltip(null);
    }
    return true;
  };

  return new ScreenGridLayer({
    id: `screengrid-layer-${fd.slice_id}` as const,
    data,
    cellSizePixels: fd.grid_size,
    colorDomain:
      colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints && colorRange
        ? [0, colorRange.length]
        : undefined,
    colorRange:
      colorSchemeType === 'default' ? defaultScreenGridColorRange : colorRange,
    outline: false,
    ...commonLayerProps({
      formData: fd,
      setDataMask,
      setTooltip,
      setTooltipContent: tooltipContent,
      filterState,
      onContextMenu,
      emitCrossFilters,
    }),
    getWeight: aggFunc,
    colorScaleType: colorSchemeType === 'default' ? 'linear' : 'quantize',
    onHover: customOnHover,
    pickable: true,
    opacity: filterState?.value ? 0.3 : 1,
  });
};

const getHighlightLayer: GetLayerType<ScreenGridLayer> = function ({
  formData,
  filterState,
  payload,
}) {
  const fd = formData;
  let data = payload.data.features;

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  const dataInside = data.filter((d: JsonObject) =>
    isPointInBonds(d.position, filterState?.value),
  );

  const aggFunc = (d: JsonObject) => d.weight || 0;

  return new ScreenGridLayer({
    id: `screengrid-highlight-layer-${formData.slice_id}` as const,
    data: dataInside,
    cellSizePixels: formData.grid_size,
    colorDomain: [0, 1],
    colorRange: [TRANSPARENT_COLOR_ARRAY, HIGHLIGHT_COLOR_ARRAY],
    outline: false,
    getWeight: aggFunc,
    colorScaleType: 'quantize',
  });
};

export default createDeckGLComponent(getLayer, getPoints, getHighlightLayer);
