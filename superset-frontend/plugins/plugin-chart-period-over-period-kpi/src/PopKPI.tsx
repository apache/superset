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
import React, { createRef } from 'react';
import { css, styled, useTheme } from '@superset-ui/core';
import {
  PopKPIComparisonSymbolStyleProps,
  PopKPIComparisonValueStyleProps,
  PopKPIProps,
} from './types';

const ComparisonValue = styled.div<PopKPIComparisonValueStyleProps>`
  ${({ theme, subheaderFontSize }) => `
    font-weight: ${theme.typography.weights.light};
    width: 33%;
    display: table-cell;
    font-size: ${subheaderFontSize || 20}px;
    text-align: center;
  `}
`;

const SymbolWrapper = styled.div<PopKPIComparisonSymbolStyleProps>`
  ${({ theme, percentDifferenceNumber, comparisonColorEnabled }) => {
    const defaultBackgroundColor = theme.colors.grayscale.light4;
    const defaultTextColor = theme.colors.grayscale.base;
    const isPositiveChange = percentDifferenceNumber > 0;
    const backgroundColor =
      percentDifferenceNumber === 0
        ? defaultBackgroundColor
        : isPositiveChange
        ? theme.colors.success.light2
        : theme.colors.error.light2;
    const textColor =
      percentDifferenceNumber === 0
        ? defaultTextColor
        : isPositiveChange
        ? theme.colors.success.base
        : theme.colors.error.base;

    return `
      background-color: ${
        comparisonColorEnabled ? backgroundColor : defaultBackgroundColor
      };
      color: ${comparisonColorEnabled ? textColor : defaultTextColor};
      padding: 2px 5px;
      border-radius: ${theme.gridUnit * 2}px;
      display: inline-block;
      margin-right: ${theme.gridUnit}px;
    `;
  }}
`;

const SYMBOLS = ['#', '△', '%'];

export default function PopKPI(props: PopKPIProps) {
  const {
    height,
    width,
    bigNumber,
    prevNumber,
    valueDifference,
    percentDifferenceFormattedString,
    headerFontSize,
    subheaderFontSize,
    comparisonColorEnabled,
    percentDifferenceNumber,
  } = props;

  const rootElem = createRef<HTMLDivElement>();
  const theme = useTheme();

  const wrapperDivStyles = css`
    font-family: ${theme.typography.families.sansSerif};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${theme.gridUnit * 4}px;
    border-radius: ${theme.gridUnit * 2}px;
    height: ${height}px;
    width: ${width}px;
  `;

  const bigValueContainerStyles = css`
    font-size: ${headerFontSize || 60}px;
    font-weight: ${theme.typography.weights.normal};
    text-align: center;
  `;

  const getArrowIndicatorColor = () => {
    if (!comparisonColorEnabled) return theme.colors.grayscale.base;
    return percentDifferenceNumber > 0
      ? theme.colors.success.base
      : theme.colors.error.base;
  };

  const arrowIndicatorStyle = css`
    color: ${getArrowIndicatorColor()};
    margin-left: ${theme.gridUnit}px;
  `;

  return (
    <div ref={rootElem} css={wrapperDivStyles}>
      <div css={bigValueContainerStyles}>
        {bigNumber}
        {percentDifferenceNumber !== 0 && (
          <span css={arrowIndicatorStyle}>
            {percentDifferenceNumber > 0 ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div
        css={css`
          width: 100%;
          display: table;
        `}
      >
        <div
          css={css`
            display: table-row;
          `}
        >
          {SYMBOLS.map((symbol, index) => (
            <ComparisonValue
              key={`comparison-symbol-${symbol}`}
              subheaderFontSize={subheaderFontSize}
            >
              <SymbolWrapper
                percentDifferenceNumber={
                  index > 0 ? percentDifferenceNumber : 0
                }
                comparisonColorEnabled={comparisonColorEnabled}
              >
                {symbol}
              </SymbolWrapper>
              {index === 0
                ? prevNumber
                : index === 1
                ? valueDifference
                : percentDifferenceFormattedString}
            </ComparisonValue>
          ))}
        </div>
      </div>
    </div>
  );
}
