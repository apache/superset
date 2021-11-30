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

import React, { CSSProperties } from 'react';
import { Dimension } from '@superset-ui/core';
import { AxisLayout } from './computeAxisLayout';

export default function createTickComponent({
  axisWidth,
  labelAngle,
  labelFlush,
  labelOverlap,
  orient,
  tickLabels,
  tickLabelDimensions,
  tickTextAnchor = 'middle',
}: AxisLayout) {
  if (labelOverlap === 'rotate' && labelAngle !== 0) {
    let xOffset = labelAngle > 0 ? -6 : 6;
    if (orient === 'top') {
      xOffset = 0;
    }
    const yOffset = orient === 'top' ? -3 : 0;

    return ({
      x,
      y,
      formattedValue = '',
      ...textStyle
    }: {
      x: number;
      y: number;
      dy?: number;
      formattedValue: string;
      textStyle: CSSProperties;
    }) => (
      <g transform={`translate(${x + xOffset}, ${y + yOffset})`}>
        <text
          transform={`rotate(${labelAngle})`}
          {...textStyle}
          textAnchor={tickTextAnchor}
        >
          {formattedValue}
        </text>
      </g>
    );
  }

  if (labelFlush === true || typeof labelFlush === 'number') {
    const labelToDimensionMap = new Map<string, Dimension>();
    tickLabels.forEach((label, i) => {
      labelToDimensionMap.set(label, tickLabelDimensions[i]);
    });

    return ({
      x,
      y,
      formattedValue = '',
      ...textStyle
    }: {
      x: number;
      y: number;
      dy?: number;
      formattedValue: string;
      textStyle: CSSProperties;
    }) => {
      const dimension = labelToDimensionMap.get(formattedValue);
      const labelWidth = typeof dimension === 'undefined' ? 0 : dimension.width;
      let textAnchor = tickTextAnchor;
      let xOffset = 0;

      if (x - labelWidth / 2 < 0) {
        textAnchor = 'start';
        if (typeof labelFlush === 'number') {
          xOffset -= labelFlush;
        }
      } else if (x + labelWidth / 2 > axisWidth) {
        textAnchor = 'end';
        if (typeof labelFlush === 'number') {
          xOffset += labelFlush;
        }
      }

      return (
        <text x={x + xOffset} y={y} {...textStyle} textAnchor={textAnchor}>
          {formattedValue}
        </text>
      );
    };
  }

  // This will render the tick as horizontal string.
  return null;
}
