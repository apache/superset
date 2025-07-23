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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ScreenGridLayer } from '@deck.gl/aggregation-layers';
import {
  JsonObject,
  JsonValue,
  QueryFormData,
  styled,
} from '@superset-ui/core';
import sandboxedEval from '../../utils/sandbox';
import TooltipRow from '../../TooltipRow';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { TooltipProps } from '../../components/Tooltip';
import {
  createTooltipContent,
  CommonTooltipRows,
} from '../../utilities/tooltipUtils';

const MoreRecordsIndicator = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.grayscale.base};
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

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: () => void,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map((d: JsonObject) => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

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
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: (d: JsonObject) => d.weight || 0,
    onHover: customOnHover,
    pickable: true,
  });
}

export type DeckGLScreenGridProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  width: number;
  height: number;
  onAddFilter: () => void;
};

const DeckGLScreenGrid = (props: DeckGLScreenGridProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();

  const getAdjustedViewport = useCallback(() => {
    const features = props.payload.data.features || [];

    const { width, height, formData } = props;

    if (formData.autozoom) {
      return fitViewport(props.viewport, {
        width,
        height,
        points: getPoints(features),
      });
    }
    return props.viewport;
  }, [props]);

  const [stateFormData, setStateFormData] = useState(props.payload.form_data);
  const [viewport, setViewport] = useState(getAdjustedViewport());

  useEffect(() => {
    if (props.payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setStateFormData(props.payload.form_data);
    }
  }, [getAdjustedViewport, props.payload.form_data, stateFormData]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const getLayers = useCallback(() => {
    const layer = getLayer(props.formData, props.payload, () => {}, setTooltip);

    return [layer];
  }, [props.formData, props.payload, setTooltip]);

  const { formData, payload, setControlValue } = props;

  return (
    <div>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        viewport={viewport}
        layers={getLayers()}
        setControlValue={setControlValue}
        mapStyle={formData.mapbox_style}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        width={props.width}
        height={props.height}
      />
    </div>
  );
};

export default memo(DeckGLScreenGrid);
