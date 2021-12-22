/*
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

/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { CSSProperties, useMemo } from 'react';
import { HEIGHT_TO_PX } from '@airbnb/lunar/lib/components/DataTable/constants';
import { RendererProps } from '@airbnb/lunar/lib/components/DataTable/types';
import { TimeFormatter, NumberFormatter } from '@superset-ui/core';
import HTMLRenderer from './components/HTMLRenderer';

const NEGATIVE_COLOR = '#FFA8A8';
const POSITIVE_COLOR = '#ced4da';
const SELECTION_COLOR = '#EBEBEB';

const NOOP = () => {};

const HEIGHT = HEIGHT_TO_PX.micro;

export type ColumnType = {
  key: string;
  label: string;
  format?: NumberFormatter | TimeFormatter | undefined;
  type: 'metric' | 'string';
  maxValue?: number;
  minValue?: number;
};

export type Cell = {
  key: string;
  value: any;
};

const NUMBER_STYLE: CSSProperties = {
  marginLeft: 'auto',
  marginRight: '4px',
  zIndex: 10,
};

export default function getRenderer({
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
  handleCellSelected: (cell: Cell) => (...args: any[]) => void;
}) {
  const { format, type } = column;

  const isMetric = type === 'metric';
  const cursorStyle = enableFilter && !isMetric ? 'pointer' : 'default';

  const boxContainerStyle: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    margin: '0px 16px',
    position: 'relative',
    textAlign: isMetric ? 'right' : 'left',
  };

  const baseBoxStyle: CSSProperties = {
    cursor: cursorStyle,
    margin: '4px -16px',
    wordBreak: 'break-all',
  };

  const selectedBoxStyle: CSSProperties = {
    ...baseBoxStyle,
    backgroundColor: SELECTION_COLOR,
  };

  const getBoxStyle = enableFilter
    ? (selected: boolean) => (selected ? selectedBoxStyle : baseBoxStyle)
    : () => baseBoxStyle;

  const posExtent = Math.abs(Math.max(column.maxValue!, 0));
  const negExtent = Math.abs(Math.min(column.minValue!, 0));
  const total = posExtent + negExtent;

  return ({ keyName, row }: RendererProps) => {
    const value = row.rowData.data[keyName];
    const cell = { key: keyName as string, value };
    const handleClick = isMetric
      ? NOOP
      : useMemo(() => handleCellSelected(cell), [cell]);

    let Parent;
    if (isMetric) {
      let left = 0;
      let width = 0;
      const numericValue = value as number;
      if (alignPositiveNegative) {
        width = Math.abs(
          Math.round(
            (numericValue /
              Math.max(column.maxValue!, Math.abs(column.minValue!))) *
              100,
          ),
        );
      } else {
        left = Math.round(
          (Math.min(negExtent + numericValue, negExtent) / total) * 100,
        );
        width = Math.round((Math.abs(numericValue) / total) * 100);
      }
      const color =
        colorPositiveNegative && numericValue < 0
          ? NEGATIVE_COLOR
          : POSITIVE_COLOR;

      Parent = ({ children }: { children: React.ReactNode }) => {
        const barStyle: CSSProperties = {
          background: color,
          borderRadius: 3,
          height: HEIGHT / 2 + 4,
          left: `${left}%`,
          position: 'absolute',
          width: `${width}%`,
        };

        return (
          <>
            <div style={barStyle} />
            <div style={NUMBER_STYLE}>{children}</div>
          </>
        );
      };
    } else {
      Parent = React.Fragment;
    }

    return (
      <div onClick={handleClick}>
        <div style={getBoxStyle(isSelected(cell))}>
          <div style={boxContainerStyle}>
            <Parent>
              {format ? (
                format.format(value as number & Date)
              ) : (
                <HTMLRenderer value={String(value)} />
              )}
            </Parent>
          </div>
        </div>
      </div>
    );
  };
}
