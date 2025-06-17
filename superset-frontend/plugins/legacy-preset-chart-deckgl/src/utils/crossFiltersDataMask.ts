import { PickingInfo, Viewport } from '@deck.gl/core';
import { ContextMenuFilters, QueryObjectFilterClause } from '@superset-ui/core';
import ngeohash from 'ngeohash';

export const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
};

type SpatialType = (typeof spatialTypes)[keyof typeof spatialTypes];

const getFiltersBySpatialType = ({
  spatialType,
  position,
  positionBounds,
  latCol,
  lonCol,
  singleValueCol,
  reverseLonLat,
  delimiter,
  customColumnLabel,
}: {
  spatialType: SpatialType;
  position: [number, number];
  positionBounds?: { from: number[]; to: number[] };
  lonCol?: string;
  latCol?: string;
  singleValueCol?: string;
  reverseLonLat?: boolean;
  delimiter?: string;
  customColumnLabel?: string;
}) => {
  let values: any[] = [];
  let filters: QueryObjectFilterClause[] = [];

  if (!position && !positionBounds)
    throw new Error('Position of picked data is required');

  switch (spatialType) {
    case spatialTypes.latlong: {
      if (lonCol != null && latCol != null) {
        const cols = [lonCol, latCol];

        if (position) {
          values = position;

          filters = [
            ...cols.map(
              (col, index) =>
                ({
                  col: {
                    expressionType: 'SQL',
                    sqlExpression: `"${col}"`,
                    label: customColumnLabel ?? `${lonCol}, ${latCol}`,
                  },
                  op: '==',
                  val: position[index],
                }) as QueryObjectFilterClause,
            ),
          ];
        } else if (positionBounds) {
          values = [positionBounds.from, positionBounds.to];

          const crossFilterColumnLabel =
            customColumnLabel ??
            `From ${lonCol}, ${latCol} to ${lonCol}, ${latCol}`;

          filters = [
            ...cols.map(
              (col, index) =>
                ({
                  col: {
                    expressionType: 'SQL',
                    sqlExpression: `"${col}"`,
                    label: crossFilterColumnLabel,
                  },
                  op: '>=',
                  val: positionBounds.from[index],
                }) as QueryObjectFilterClause,
            ),
            ...cols.map(
              (col, index) =>
                ({
                  col: {
                    expressionType: 'SQL',
                    sqlExpression: `"${col}"`,
                    label: crossFilterColumnLabel,
                  },
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
      const col = singleValueCol;

      if (!col) return null;

      const val = (reverseLonLat ? position.reverse() : position).join(
        delimiter,
      );

      values = [val];

      filters = [
        {
          col: {
            expressionType: 'SQL',
            sqlExpression: `"${col}"`,
            label: customColumnLabel ?? col,
          },
          op: '==',
          val,
        },
      ];

      break;
    }
    case spatialTypes.geohash: {
      const col = singleValueCol;

      if (!col) return null;

      const [lon, lat] = position;
      const val = ngeohash.encode(lat, lon, 12);

      values = [val];

      filters = [
        {
          col: {
            expressionType: 'SQL',
            sqlExpression: `"${col}"`,
            label: customColumnLabel ?? col,
          },
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
}) => {
  const buffer = 0.01 / Math.pow(2, viewport.zoom / 2);

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

export const getCrossFilterDataMask = ({
  data,
  filterState,
  formData,
}: {
  data: PickingInfo;
  filterState: any;
  formData: any;
}) => {
  let values: any[] = [];
  let filters: QueryObjectFilterClause[] = [];

  if (formData.start_spatial && formData.end_spatial) {
    const sourcePosition: [number, number] = data.object?.sourcePosition;
    const targetPosition: [number, number] = data.object?.targetPosition;

    if (!sourcePosition || !targetPosition)
      throw new Error('Position of picked data is required');

    const customColumnLabel = `Start ${getSpatialColumnLabel(formData.start_spatial)} end ${getSpatialColumnLabel(formData.end_spatial)}`;

    const startSpatialFilters = getFiltersBySpatialType({
      position: sourcePosition,
      spatialType: formData.start_spatial.type,
      latCol: formData.start_spatial.latCol,
      lonCol: formData.start_spatial.lonCol,
      singleValueCol:
        formData.start_spatial.geohashCol || formData.start_spatial.line_column,
      customColumnLabel,
    });

    const endSpatialFilters = getFiltersBySpatialType({
      position: targetPosition,
      spatialType: formData.end_spatial.type,
      latCol: formData.end_spatial.latCol,
      lonCol: formData.end_spatial.lonCol,
      singleValueCol:
        formData.end_spatial.geohashCol || formData.end_spatial.line_column,
      customColumnLabel,
    });

    if (startSpatialFilters && endSpatialFilters) {
      values = [startSpatialFilters.values, endSpatialFilters.values];
      filters = [
        ...startSpatialFilters?.filters,
        ...endSpatialFilters?.filters,
      ];
    }
  } else if (formData.spatial?.type) {
    const position = (data.object?.points?.[0]?.position ||
      data.object?.position) as [number, number];

    let positionBounds;

    if (!position && data.coordinate && data.viewport) {
      const pickedPositionBounds = calculatePickedPositionBounds({
        pickedCoordinates: data.coordinate,
        viewport: data.viewport,
      });

      positionBounds = pickedPositionBounds;
    }

    const result = getFiltersBySpatialType({
      position,
      positionBounds,
      spatialType: formData.spatial.type,
      lonCol: formData.spatial.lonCol,
      latCol: formData.spatial.latCol,
      singleValueCol: formData.spatial.lonlatCol || formData.spatial.geohashCol,
    });

    if (result) {
      ({ values, filters } = result);
    }
  } else if (formData.line_column) {
    const path = (data?.object?.path || data.object?.polygon) as string;
    const val = JSON.stringify(path);

    if (!path) throw new Error('Position of picked data is required');

    values = [val];

    filters = [
      {
        col: {
          expressionType: 'SQL',
          sqlExpression: `REPLACE(${formData.line_column}, ' ', '')`,
          label: formData.line_column,
        },
        op: '==',
        val,
      },
    ];
  } else if (formData.geojson) {
    const geometry = data.object?.geometry?.coordinates;

    if (!geometry) throw new Error('Geometry of picked data is required');

    const val = `%${JSON.stringify(geometry)}%`;

    values = [val];

    filters = [
      {
        col: {
          expressionType: 'SQL',
          sqlExpression: `REPLACE(${formData.geojson}, ' ', '')`,
          label: formData.geojson,
        },
        op: 'LIKE',
        val,
      },
    ];
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
