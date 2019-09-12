/* eslint-disable complexity */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-magic-numbers */
import React, { CSSProperties } from 'react';
import { HEIGHT_TO_PX } from '@airbnb/lunar/lib/components/DataTable/constants';
import { RendererProps } from '@airbnb/lunar/lib/components/DataTable/types';
import Interweave from '@airbnb/lunar/lib/components/Interweave';

const NEGATIVE_COLOR = '#FFA8A8';
const POSITIVE_COLOR = '#ced4da';
const SELECTION_COLOR = '#EBEBEB';

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

const numberStyle: CSSProperties = {
  marginLeft: 'auto',
  marginRight: '4px',
  zIndex: 10,
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
  const { keyName } = props;
  const value = props.row.rowData.data[keyName];
  const isMetric = column.type === 'metric';
  let Parent;

  const cursorStyle = enableFilter && !isMetric ? 'pointer' : 'default';

  const boxStyle: CSSProperties = {
    backgroundColor:
      enableFilter && isSelected({ key: keyName, value }) ? SELECTION_COLOR : undefined,
    cursor: cursorStyle,
    margin: '0px -16px',
  };

  const boxContainerStyle: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    height: HEIGHT_TO_PX[heightType],
    margin: '0px 16px',
    position: 'relative',
    textAlign: isMetric ? 'right' : 'left',
  };

  const FullCellBackgroundWrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={boxStyle}>
      <div style={boxContainerStyle}>{children}</div>
    </div>
  );

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
      const barStyle: CSSProperties = {
        background: color,
        borderRadius: 3,
        height: HEIGHT_TO_PX[heightType] / 2 + 4,
        left: `${left}%`,
        position: 'absolute',
        width: `${width}%`,
      };

      return (
        <FullCellBackgroundWrapper>
          <div style={barStyle} />
          <div style={numberStyle}>{children}</div>
        </FullCellBackgroundWrapper>
      );
    };
  } else {
    Parent = ({ children }: { children: React.ReactNode }) => (
      <FullCellBackgroundWrapper>{children}</FullCellBackgroundWrapper>
    );
  }

  return (
    <div
      onClick={
        isMetric
          ? null
          : handleCellSelected({
              key: keyName,
              value,
            })
      }
    >
      <Parent>{column.format ? column.format(value) : <Interweave content={value} />}</Parent>
    </div>
  );
};
