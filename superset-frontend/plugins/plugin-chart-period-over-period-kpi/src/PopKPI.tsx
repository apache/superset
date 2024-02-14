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
import React, { createRef, useMemo } from 'react';
import { css, styled, t, useTheme } from '@superset-ui/core';
import { Tooltip } from '@superset-ui/chart-controls';
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
  ${({ theme, backgroundColor, textColor }) => `
    background-color: ${backgroundColor};
    color: ${textColor};
    padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
    border-radius: ${theme.gridUnit * 2}px;
    display: inline-block;
    margin-right: ${theme.gridUnit}px;
  `}
`;

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
    comparatorText,
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

  const defaultBackgroundColor = theme.colors.grayscale.light4;
  const defaultTextColor = theme.colors.grayscale.base;
  const { backgroundColor, textColor } = useMemo(() => {
    let bgColor = defaultBackgroundColor;
    let txtColor = defaultTextColor;
    if (percentDifferenceNumber > 0) {
      if (comparisonColorEnabled) {
        bgColor = theme.colors.success.light2;
        txtColor = theme.colors.success.base;
      }
    } else if (percentDifferenceNumber < 0) {
      if (comparisonColorEnabled) {
        bgColor = theme.colors.error.light2;
        txtColor = theme.colors.error.base;
      }
    }

    return {
      backgroundColor: bgColor,
      textColor: txtColor,
    };
  }, [theme, comparisonColorEnabled, percentDifferenceNumber]);

  const SYMBOLS_WITH_VALUES = useMemo(
    () => [
      {
        symbol: '#',
        value: prevNumber,
        tooltipText: t('Data for %s', comparatorText),
      },
      {
        symbol: '△',
        value: valueDifference,
        tooltipText: t('Value difference between the time periods'),
      },
      {
        symbol: '%',
        value: percentDifferenceFormattedString,
        tooltipText: t('Percentage difference between the time periods'),
      },
    ],
    [prevNumber, valueDifference, percentDifferenceFormattedString],
  );

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
          {SYMBOLS_WITH_VALUES.map((symbol_with_value, index) => (
            <ComparisonValue
              key={`comparison-symbol-${symbol_with_value.symbol}`}
              subheaderFontSize={subheaderFontSize}
            >
              <Tooltip
                id="tooltip"
                placement="top"
                title={symbol_with_value.tooltipText}
              >
                <SymbolWrapper
                  backgroundColor={
                    index > 0 ? backgroundColor : defaultBackgroundColor
                  }
                  textColor={index > 0 ? textColor : defaultTextColor}
                >
                  {symbol_with_value.symbol}
                </SymbolWrapper>
                {symbol_with_value.value}
              </Tooltip>
            </ComparisonValue>
          ))}
        </div>
      </div>
    </div>
  );
}
