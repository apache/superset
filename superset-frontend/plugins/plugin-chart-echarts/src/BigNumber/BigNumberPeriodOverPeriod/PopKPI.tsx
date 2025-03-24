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
import { useEffect, useMemo, useState } from 'react';
import {
  css,
  ensureIsArray,
  fetchTimeRange,
  getTimeOffset,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { DEFAULT_DATE_PATTERN, Tooltip } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import {
  ColorSchemeEnum,
  PopKPIComparisonSymbolStyleProps,
  PopKPIComparisonValueStyleProps,
  PopKPIProps,
} from './types';
import { useOverflowDetection } from './useOverflowDetection';

const NumbersContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  overflow: auto;
`;

const ComparisonValue = styled.div<PopKPIComparisonValueStyleProps>`
  ${({ theme, subheaderFontSize }) => `
    font-weight: ${theme.typography.weights.light};
    display: flex;
    justify-content: center;
    font-size: ${subheaderFontSize || 20}px;
    flex: 1 1 0px;
  `}
`;

const SymbolWrapper = styled.span<PopKPIComparisonSymbolStyleProps>`
  ${({ theme, backgroundColor, textColor }) => `
    background-color: ${backgroundColor};
    color: ${textColor};
    padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
    border-radius: ${theme.gridUnit * 2}px;
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
    comparisonColorScheme,
    percentDifferenceNumber,
    currentTimeRangeFilter,
    startDateOffset,
    shift,
    dashboardTimeRange,
  } = props;

  const [comparisonRange, setComparisonRange] = useState<string>('');

  useEffect(() => {
    if (!currentTimeRangeFilter || (!shift && !startDateOffset)) {
      setComparisonRange('');
    } else if (!isEmpty(shift) || startDateOffset) {
      const promise: any = fetchTimeRange(
        dashboardTimeRange ?? (currentTimeRangeFilter as any).comparator,
        currentTimeRangeFilter.subject,
      );
      Promise.resolve(promise).then((res: any) => {
        const dates = res?.value?.match(DEFAULT_DATE_PATTERN);
        const [parsedStartDate, parsedEndDate] = dates ?? [];
        const newShift = getTimeOffset({
          timeRangeFilter: {
            ...currentTimeRangeFilter,
            comparator: `${parsedStartDate} : ${parsedEndDate}`,
          },
          shifts: ensureIsArray(shift),
          startDate: startDateOffset || '',
        });
        fetchTimeRange(
          dashboardTimeRange ?? (currentTimeRangeFilter as any).comparator,
          currentTimeRangeFilter.subject,
          ensureIsArray(newShift),
        ).then(res => {
          const response: string[] = ensureIsArray(res.value);
          const firstRange: string = response.flat()[0];
          const rangeText = firstRange.split('vs\n');
          setComparisonRange(
            rangeText.length > 1 ? rangeText[1].trim() : rangeText[0],
          );
        });
      });
    }
  }, [currentTimeRangeFilter, shift, startDateOffset, dashboardTimeRange]);

  const theme = useTheme();
  const flexGap = theme.gridUnit * 5;
  const wrapperDivStyles = css`
    font-family: ${theme.typography.families.sansSerif};
    display: flex;
    justify-content: center;
    align-items: center;
    height: ${height}px;
    width: ${width}px;
    overflow: auto;
  `;

  const bigValueContainerStyles = css`
    font-size: ${headerFontSize || 60}px;
    font-weight: ${theme.typography.weights.normal};
    text-align: center;
    margin-bottom: ${theme.gridUnit * 4}px;
  `;

  const getArrowIndicatorColor = () => {
    if (!comparisonColorEnabled || percentDifferenceNumber === 0) {
      return theme.colors.grayscale.base;
    }

    if (percentDifferenceNumber > 0) {
      // Positive difference
      return comparisonColorScheme === ColorSchemeEnum.Green
        ? theme.colors.success.base
        : theme.colors.error.base;
    }
    // Negative difference
    return comparisonColorScheme === ColorSchemeEnum.Red
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
    if (comparisonColorEnabled && percentDifferenceNumber !== 0) {
      const useSuccess =
        (percentDifferenceNumber > 0 &&
          comparisonColorScheme === ColorSchemeEnum.Green) ||
        (percentDifferenceNumber < 0 &&
          comparisonColorScheme === ColorSchemeEnum.Red);

      // Set background and text colors based on the conditions
      bgColor = useSuccess
        ? theme.colors.success.light2
        : theme.colors.error.light2;
      txtColor = useSuccess
        ? theme.colors.success.base
        : theme.colors.error.base;
    }

    return {
      backgroundColor: bgColor,
      textColor: txtColor,
    };
  }, [
    theme,
    comparisonColorScheme,
    comparisonColorEnabled,
    percentDifferenceNumber,
  ]);

  const SYMBOLS_WITH_VALUES = useMemo(
    () => [
      {
        symbol: '#',
        value: prevNumber,
        tooltipText: t('Data for %s', comparisonRange || 'previous range'),
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
    [
      comparisonRange,
      prevNumber,
      valueDifference,
      percentDifferenceFormattedString,
    ],
  );

  const { isOverflowing, symbolContainerRef, wrapperRef } =
    useOverflowDetection(flexGap);

  return (
    <div css={wrapperDivStyles} ref={wrapperRef}>
      <NumbersContainer
        css={
          isOverflowing &&
          css`
            width: fit-content;
            margin: auto;
            align-items: flex-start;
          `
        }
      >
        <div css={bigValueContainerStyles}>
          {bigNumber}
          {percentDifferenceNumber !== 0 && (
            <span css={arrowIndicatorStyle}>
              {percentDifferenceNumber > 0 ? '↑' : '↓'}
            </span>
          )}
        </div>

        <div
          css={[
            css`
              display: flex;
              justify-content: space-around;
              gap: ${flexGap}px;
              min-width: 0;
              flex-shrink: 1;
            `,
            isOverflowing
              ? css`
                  flex-direction: column;
                  align-items: flex-start;
                  width: fit-content;
                `
              : css`
                  align-items: center;
                  width: 100%;
                `,
          ]}
          ref={symbolContainerRef}
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
      </NumbersContainer>
    </div>
  );
}
