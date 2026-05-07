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
import { PickingInfo, Viewport } from '@deck.gl/core';
import {
  ContextMenuFilters,
  FilterState,
  QueryObjectFilterClause,
  SqlaFormData,
} from '@superset-ui/core';
import ngeohash from 'ngeohash';

const GEOHASH_PRECISION = 12;
const VIEWPORT_BUFFER_FACTOR = 0.3;
const ZOOM_DIVISOR = 2;

export const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
} as const;

type SpatialType = (typeof spatialTypes)[keyof typeof spatialTypes];

export type SpatialData = {
  latCol?: string;
  lonCol?: string;
  lonlatCol?: string;
  reverseCheckbox?: boolean;
  delimiter?: string;
  type: SpatialType;
  geohashCol?: string;
  line_column?: string;
};

export interface LayerFormData extends SqlaFormData {
  start_spatial?: SpatialData;
  end_spatial?: SpatialData;
  spatial?: SpatialData;
  line_column?: string;
  geojson?: string;
}

export interface FilterResult {
  filters: QueryObjectFilterClause[];
  values: FilterState;
  customColumnLabel?: string;
}

export interface PositionBounds {
  from: [number, number];
  to: [number, number];
}

export interface ValidatedPickingData {
  position?: [number, number];
  positionBounds?: PositionBounds;
  sourcePosition?: [number, number];
  targetPosition?: [number, number];
  path?: string;
  geometry?: any;
}

const getFiltersBySpatialType = ({
  position,
  positions,
  positionBounds,
  spatialData,
}: {
  position?: [number, number];
  positions?: [number, number][];
  spatialData: SpatialData;
  positionBounds?: PositionBounds;
}) => {
  const {
    lonCol,
    latCol,
    lonlatCol,
    geohashCol,
    reverseCheckbox,
    type,
    delimiter,
  } = spatialData;
  let values: any[] = [];
  let filters: QueryObjectFilterClause[] = [];
  let customColumnLabel;

  if (!position && !positions && !positionBounds)
    throw new Error('Position of picked data is required');

  switch (type) {
    case spatialTypes.latlong: {
      if (lonCol != null && latCol != null) {
        const cols = [lonCol, latCol];

        if (positions && positions.length > 0) {
          values = positions;
          customColumnLabel = cols.join(', ');

          filters = [
            {
              col: lonCol,
              op: 'IN',
              val: positions.map(pos => pos[0]),
            },
            {
              col: latCol,
              op: 'IN',
              val: positions.map(pos => pos[1]),
            },
          ];
        } else if (position) {
          values = position;
          customColumnLabel = cols.join(', ');

          filters = [
            ...cols.map(
              (col, index) =>
                ({
                  col,
                  op: '==',
                  val: position[index],
                }) as QueryObjectFilterClause,
            ),
          ];
        } else if (positionBounds) {
          values = [positionBounds.from, positionBounds.to];
          customColumnLabel = `From ${lonCol}, ${latCol} to ${lonCol}, ${latCol}`;

          filters = [
            ...cols.map(
              (col, index) =>
                ({
                  col,
                  op: '>=',
                  val: positionBounds.from[index],
                }) as QueryObjectFilterClause,
            ),
            ...cols.map(
              (col, index) =>
                ({
                  col,
                  op: '<=',
                  val: positionBounds.to[index],
                }) as QueryObjectFilterClause,
            ),
          ];
        }
      }

      break;
    }
    case spatialTypes.delimited: {
      const col = lonlatCol ?? geohashCol;

      if (!col) throw new Error('Column is required');

      if (positions && positions.length > 0) {
        const vals = positions.map(pos =>
          (reverseCheckbox ? [...pos].reverse() : pos).join(delimiter),
        );

        values = vals;

        filters = [
          {
            col,
            op: 'IN',
            val: vals,
          },
        ];
      } else if (position) {
        const val = (reverseCheckbox ? position.reverse() : position).join(
          delimiter,
        );

        values = [val];

        filters = [
          {
            col,
            op: '==',
            val,
          },
        ];
      }

      break;
    }
    case spatialTypes.geohash: {
      const col = lonlatCol ?? geohashCol;

      if (!col) throw new Error('Column is required');

      if (positions && positions.length > 0) {
        const vals = positions.map(pos => {
          const [lon, lat] = pos;
          return ngeohash.encode(lat, lon, GEOHASH_PRECISION);
        });

        values = vals;

        filters = [
          {
            col,
            op: 'IN',
            val: vals,
          },
        ];
      } else if (position) {
        const [lon, lat] = position;
        const val = ngeohash.encode(lat, lon, GEOHASH_PRECISION);

        values = [val];

        filters = [
          {
            col,
            op: '==',
            val,
          },
        ];
      }

      break;
    }
    default: {
      values = [];
    }
  }

  return {
    filters,
    values,
    customColumnLabel,
  };
};

const calculatePickedPositionBounds = ({
  pickedCoordinates,
  viewport,
}: {
  pickedCoordinates: number[];
  viewport: Viewport;
}): PositionBounds => {
  const buffer =
    VIEWPORT_BUFFER_FACTOR / Math.pow(2, viewport.zoom / ZOOM_DIVISOR);

  return {
    from: [pickedCoordinates[0] - buffer, pickedCoordinates[1] - buffer],
    to: [pickedCoordinates[0] + buffer, pickedCoordinates[1] + buffer],
  };
};

const getSpatialColumnLabel = ({
  latCol,
  lonCol,
  geohashCol,
  line_column,
}: {
  latCol?: string;
  lonCol?: string;
  geohashCol?: string;
  line_column?: string;
}) => {
  if (latCol && lonCol) {
    return `${latCol}, ${lonCol}`;
  }
  if (geohashCol) {
    return geohashCol;
  }
  if (line_column) {
    return line_column;
  }
  return '';
};

const getStartEndSpatialFilters = ({
  formData,
  data,
}: {
  formData: LayerFormData;
  data: PickingInfo;
}): FilterResult => {
  const sourcePosition: [number, number] = data.object?.sourcePosition;
  const targetPosition: [number, number] = data.object?.targetPosition;

  if (!sourcePosition || !targetPosition)
    throw new Error('Position of picked data is required');

  if (!formData.start_spatial || !formData.end_spatial)
    throw new Error('Spatial data is required');

  const customColumnLabel = `Start ${getSpatialColumnLabel(formData.start_spatial)} end ${getSpatialColumnLabel(formData.end_spatial)}`;

  const startSpatialFilters = getFiltersBySpatialType({
    position: sourcePosition,
    spatialData: formData.start_spatial,
  });

  const endSpatialFilters = getFiltersBySpatialType({
    position: targetPosition,
    spatialData: formData.end_spatial,
  });

  if (!startSpatialFilters || !endSpatialFilters)
    throw new Error('Failed to generate filters');

  return {
    values: [startSpatialFilters.values, endSpatialFilters.values],
    filters: [
      ...(startSpatialFilters.filters || []),
      ...(endSpatialFilters.filters || []),
    ],
    customColumnLabel,
  };
};

const isPointInBounds = (
  point: [number, number],
  bounds: PositionBounds,
): boolean =>
  point[0] >= bounds.from[0] &&
  point[0] <= bounds.to[0] &&
  point[1] >= bounds.from[1] &&
  point[1] <= bounds.to[1];

const getSpatialFilters = ({
  formData,
  data,
  filterState,
}: {
  formData: LayerFormData;
  data: PickingInfo;
  filterState?: FilterState;
}): FilterResult => {
  const positions = data.object?.points?.map(
    (point: { position: [number, number]; weight: number }) => point.position,
  ) as [number, number][];

  let positionBounds: PositionBounds | undefined;

  if (!positions && data.coordinate && data.viewport) {
    const pickedPositionBounds = calculatePickedPositionBounds({
      pickedCoordinates: data.coordinate,
      viewport: data.viewport,
    });

    positionBounds = pickedPositionBounds;

    if (filterState?.value && data.coordinate) {
      const currentFilterValues = filterState.value;
      if (
        Array.isArray(currentFilterValues) &&
        currentFilterValues.length === 2
      ) {
        const currentBounds: PositionBounds = {
          from: currentFilterValues[0] as [number, number],
          to: currentFilterValues[1] as [number, number],
        };

        const pickedPoint: [number, number] = [
          data.coordinate[0],
          data.coordinate[1],
        ];

        if (isPointInBounds(pickedPoint, currentBounds)) {
          return {
            filters: [],
            values: currentFilterValues,
            customColumnLabel: filterState.customColumnLabel,
          };
        }
      }
    }
  }

  if (!formData.spatial) throw new Error('Spatial data is required');

  return getFiltersBySpatialType({
    positions,
    positionBounds,
    spatialData: formData.spatial,
  });
};

const getLineColumnFilters = ({
  formData,
  data,
}: {
  formData: LayerFormData;
  data: PickingInfo;
}): FilterResult => {
  const path = (data?.object?.path || data.object?.polygon) as string;
  const val = JSON.stringify(path);

  if (!formData.line_column) throw new Error('Line column is required');
  if (!path) throw new Error('Position of picked data is required');

  return {
    values: [val],
    filters: [
      {
        col: {
          expressionType: 'SQL',
          sqlExpression: `REPLACE(${formData.line_column}, ' ', '')`,
          label: formData.line_column,
        },
        op: '==',
        val,
      },
    ],
  };
};

const getGeojsonFilters = ({
  formData,
  data,
}: {
  formData: LayerFormData;
  data: PickingInfo;
}): FilterResult => {
  const geometry = data.object?.geometry?.coordinates;

  if (!geometry) throw new Error('Position of picked data is required');

  const val = `%${JSON.stringify(geometry)}%`;

  return {
    values: [geometry],
    filters: [
      {
        col: {
          expressionType: 'SQL',
          sqlExpression: `REPLACE(${formData.geojson}, ' ', '')`,
          label: formData.geojson,
        },
        op: 'LIKE',
        val,
      },
    ],
  };
};

export const getCrossFilterDataMask = ({
  data,
  filterState,
  formData,
}: {
  data: PickingInfo;
  filterState?: FilterState;
  formData: LayerFormData;
}) => {
  let values: FilterState['value'] = [];
  let filters: QueryObjectFilterClause[] = [];
  let customColumnLabel: string | undefined;

  if (formData.start_spatial && formData.end_spatial) {
    const result = getStartEndSpatialFilters({ formData, data });
    ({ values, filters, customColumnLabel } = result);
  } else if (formData.spatial?.type) {
    const result = getSpatialFilters({ formData, data, filterState });
    ({ values, filters, customColumnLabel } = result);
  } else if (formData.line_column) {
    const result = getLineColumnFilters({ formData, data });
    ({ values, filters, customColumnLabel } = result);
  } else if (formData.geojson) {
    const result = getGeojsonFilters({ formData, data });
    ({ values, filters, customColumnLabel } = result);
  } else {
    throw new Error('No valid spatial configuration found in form data');
  }

  const isSelected =
    values &&
    filterState?.value?.every(
      (val: string, i: number) => val.toString() === values[i].toString(),
    );

  if (isSelected) {
    values = [];
  }

  return {
    dataMask: {
      extraFormData: {
        filters: values.length ? filters : [],
      },
      filterState: {
        value: values.length ? values : null,
        ...(customColumnLabel && values.length ? { customColumnLabel } : {}),
      },
    },
    isCurrentValueSelected: isSelected || false,
  } as ContextMenuFilters['crossFilter'];
};
