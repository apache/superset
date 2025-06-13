import { PickingInfo } from '@deck.gl/core';
import { ContextMenuFilters, QueryObjectFilterClause } from '@superset-ui/core';
import ngeohash from 'ngeohash';

export const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
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
  if (!formData.spatial?.type || !data.object) return null;

  let values: string[] | number[];
  let filters: QueryObjectFilterClause[] = [];

  const clickedPointPosition = data.object.points[0].position as [
    number,
    number,
  ];

  switch (formData.spatial.type) {
    case spatialTypes.latlong: {
      const cols = [formData.spatial.lonCol, formData.spatial.latCol];

      values = clickedPointPosition;

      filters = [
        ...cols.map(
          (col, index) =>
            ({
              col,
              op: '==',
              val: clickedPointPosition[index],
            }) as QueryObjectFilterClause,
        ),
      ];

      break;
    }
    case spatialTypes.delimited: {
      const col = formData.spatial.lonlatCol;
      const val = (
        formData.spatial.reverseCheckbox
          ? clickedPointPosition.reverse()
          : clickedPointPosition
      ).join(formData.spatial.delimiter);

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
      const col = formData.spatial.geohashCol;
      const val = ngeohash.encode(
        ...(formData.spatial.reverseCheckbox
          ? clickedPointPosition
          : (clickedPointPosition.reverse() as [number, number])),
        12,
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
    default: {
      values = [];
    }
  }

  const isSelected = filterState?.value?.every(
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
    isCurrentValueSelected: isSelected,
  } as ContextMenuFilters['crossFilter'];
};
