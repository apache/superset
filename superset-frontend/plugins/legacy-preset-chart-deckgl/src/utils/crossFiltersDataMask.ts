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
  let values: string[] | number[] = [];
  let filters: QueryObjectFilterClause[] = [];

  if (formData.spatial?.type) {
    const position = (data.object?.points?.[0]?.position ||
      data.object?.position) as [number, number];

    switch (formData.spatial.type) {
      case spatialTypes.latlong: {
        const cols = [formData.spatial.lonCol, formData.spatial.latCol];

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

        break;
      }
      case spatialTypes.delimited: {
        const col = formData.spatial.lonlatCol;
        const val = (
          formData.spatial.reverseCheckbox ? position.reverse() : position
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
            ? position
            : (position.reverse() as [number, number])),
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
  } else if (formData.line_column) {
    const path = data?.object?.path as string;
    const val = [path].toString();

    values = [val];

    filters = [
      {
        col: formData.line_column,
        op: '==',
        val,
      },
    ];
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
