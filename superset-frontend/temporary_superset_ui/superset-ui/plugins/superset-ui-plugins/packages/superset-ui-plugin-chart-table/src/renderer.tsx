import React, { CSSProperties } from 'react';
import { HEIGHT_TO_PX } from '@airbnb/lunar/lib/components/DataTable/constants';
import { RendererProps } from '@airbnb/lunar/lib/components/DataTable/types';

const NEGATIVE_COLOR = '#ff8787';
const POSITIVE_COLOR = '#ced4da';
const SELECTION_COLOR = '#ffec99';

export const heightType = 'micro';

export type ColumnType = {
  key: string;
  label: string;
  format?: (value: any) => string;
  type: 'metric' | 'string';
  maxValue?: number;
  minValue?: number;
};

export type Cell = {
  key: string;
  value: any;
};

export const getRenderer = ({
  column,
  alignPositiveNegative,
  colorPositiveNegative,
  enableFilter,
  isSelected,
  handleCellSelected,
}: {
  column: ColumnType;
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  enableFilter: boolean;
  isSelected: (cell: Cell) => boolean;
  handleCellSelected: (cell: Cell) => any;
}) => (props: RendererProps) => {
  const { key } = props;
  let value = props.row.rowData.data[key];
  const isMetric = column.type === 'metric';
  let Parent;

  if (isMetric) {
    let left = 0;
    let width = 0;
    if (alignPositiveNegative) {
      width = Math.abs(
        Math.round((value / Math.max(column.maxValue!, Math.abs(column.minValue!))) * 100),
      );
    } else {
      const posExtent = Math.abs(Math.max(column.maxValue!, 0));
      const negExtent = Math.abs(Math.min(column.minValue!, 0));
      const tot = posExtent + negExtent;
      left = Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
      width = Math.round((Math.abs(value) / tot) * 100);
    }
    const color = colorPositiveNegative && value < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR;
    Parent = ({ children }: { children: React.ReactNode }) => {
      const boxStyle: CSSProperties = {
        margin: '0px -16px',
        backgroundColor: enableFilter && isSelected({ key, value }) ? SELECTION_COLOR : undefined,
      };
      const boxContainerStyle: CSSProperties = {
        position: 'relative',
        height: HEIGHT_TO_PX[heightType],
        textAlign: isMetric ? 'right' : 'left',
        display: 'flex',
        alignItems: 'center',
        margin: '0px 16px',
      };
      const barStyle: CSSProperties = {
        background: color,
        width: `${width}%`,
        left: `${left}%`,
        position: 'absolute',
        height: HEIGHT_TO_PX[heightType] / 2,
      };

      return (
        <div style={boxStyle}>
          <div style={boxContainerStyle}>
            <div style={barStyle} />
            <div style={{ zIndex: 10, marginLeft: 'auto' }}>{children}</div>
          </div>
        </div>
      );
    };
  } else {
    Parent = ({ children }: { children: React.ReactNode }) => (
      <React.Fragment>{children}</React.Fragment>
    );
  }

  return (
    <div
      onClick={handleCellSelected({
        key,
        value,
      })}
    >
      <Parent>{column.format ? column.format(value) : value}</Parent>
    </div>
  );
};
