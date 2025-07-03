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
  positionBounds,
  spatialData,
}: {
  position: [number, number];
  spatialData: SpatialData;
  positionBounds?: PositionBounds;
  customColumnLabel?: string;
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

  if (!position && !positionBounds)
    throw new Error('Position of picked data is required');

  switch (type) {
    case spatialTypes.latlong: {
      if (lonCol != null && latCol != null) {
        const cols = [lonCol, latCol];

        if (position) {
          values = position;

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

      break;
    }
    case spatialTypes.geohash: {
      const col = lonlatCol ?? geohashCol;

      if (!col) throw new Error('Column is required');

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

      break;
    }
    default: {
      values = [];
    }
  }

  return {
    filters,
    values,
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
    customColumnLabel,
  });

  const endSpatialFilters = getFiltersBySpatialType({
    position: targetPosition,
    spatialData: formData.end_spatial,
    customColumnLabel,
  });

  if (!startSpatialFilters || !endSpatialFilters)
    throw new Error('Failed to generate filters');

  return {
    values: [startSpatialFilters.values, endSpatialFilters.values],
    filters: [
      ...(startSpatialFilters.filters || []),
      ...(endSpatialFilters.filters || []),
    ],
  };
};

const getSpatialFilters = ({
  formData,
  data,
}: {
  formData: LayerFormData;
  data: PickingInfo;
}): FilterResult => {
  const position = (data.object?.points?.[0]?.position ||
    data.object?.position) as [number, number];

  let positionBounds: PositionBounds | undefined;

  if (!position && data.coordinate && data.viewport) {
    const pickedPositionBounds = calculatePickedPositionBounds({
      pickedCoordinates: data.coordinate,
      viewport: data.viewport,
    });

    positionBounds = pickedPositionBounds;
  }

  if (!formData.spatial) throw new Error('Spatial data is required');

  return getFiltersBySpatialType({
    position,
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
    values: [val],
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

  if (formData.start_spatial && formData.end_spatial) {
    const result = getStartEndSpatialFilters({ formData, data });
    ({ values, filters } = result);
  } else if (formData.spatial?.type) {
    const result = getSpatialFilters({ formData, data });
    ({ values, filters } = result);
  } else if (formData.line_column) {
    const result = getLineColumnFilters({ formData, data });
    ({ values, filters } = result);
  } else if (formData.geojson) {
    const result = getGeojsonFilters({ formData, data });
    ({ values, filters } = result);
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
      },
    },
    isCurrentValueSelected: isSelected || false,
  } as ContextMenuFilters['crossFilter'];
};
