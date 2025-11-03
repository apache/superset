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
import { Tooltip } from '@superset-ui/core/components';
import { DEFAULT_DATE_PATTERN } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import {
  ColorSchemeEnum,
  PopKPIComparisonSymbolStyleProps,
  PopKPIComparisonValueStyleProps,
  PopKPIProps,
} from './types';
import { useOverflowDetection } from './useOverflowDetection';

const MetricNameText = styled.div<{ metricNameFontSize?: number }>`
  ${({ theme, metricNameFontSize }) => `
    font-family: ${theme.fontFamily};
    font-weight: ${theme.fontWeightNormal};
    font-size: ${metricNameFontSize || theme.fontSizeSM * 2}px;
    text-align: center;
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const NumbersContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 12px;
`;

const ComparisonValue = styled.div<PopKPIComparisonValueStyleProps>`
  ${({ theme, subheaderFontSize }) => `
    font-weight: ${theme.fontWeightLight};
    display: flex;
    justify-content: center;
    font-size: ${String(subheaderFontSize) || 20}px;
    flex: 1 1 0px;
  `}
`;

const SymbolWrapper = styled.span<PopKPIComparisonSymbolStyleProps>`
  ${({ theme, backgroundColor, textColor }) => `
    background-color: ${backgroundColor};
    color: ${textColor};
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    margin-right: ${theme.sizeUnit}px;
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
    metricName,
    metricNameFontSize,
    headerFontSize,
    subheaderFontSize,
    comparisonColorEnabled,
    comparisonColorScheme,
    percentDifferenceNumber,
    currentTimeRangeFilter,
    startDateOffset,
    shift,
    subtitle,
    subtitleFontSize,
    dashboardTimeRange,
    showMetricName,
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
  const flexGap = theme.sizeUnit * 5;
  const wrapperDivStyles = css`
    font-family: ${theme.fontFamily};
    display: flex;
    justify-content: center;
    align-items: center;
    height: ${height}px;
    width: ${width}px;
    overflow: auto;
  `;

  const bigValueContainerStyles = css`
    font-size: ${String(headerFontSize) || 60}px;
    font-weight: ${theme.fontWeightNormal};
    text-align: center;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `;

  const SubtitleText = styled.div`
    ${({ theme }) => `
    font-family: ${theme.fontFamily};
    font-weight: ${theme.fontWeightNormal};
    text-align: center;
    margin-top: -10px;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
  `;

  const getArrowIndicatorColor = () => {
    if (!comparisonColorEnabled || percentDifferenceNumber === 0) {
      return theme.colorTextTertiary;
    }

    if (percentDifferenceNumber > 0) {
      // Positive difference
      return comparisonColorScheme === ColorSchemeEnum.Green
        ? theme.colorSuccess
        : theme.colorError;
    }
    // Negative difference
    return comparisonColorScheme === ColorSchemeEnum.Red
      ? theme.colorSuccess
      : theme.colorError;
  };

  const arrowIndicatorStyle = css`
    color: ${getArrowIndicatorColor()};
    margin-left: ${theme.sizeUnit}px;
  `;

  const defaultBackgroundColor = theme.colorBgContainer;
  const defaultTextColor = theme.colorTextTertiary;
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
      bgColor = useSuccess ? theme.colorSuccessBg : theme.colorErrorBg;
      txtColor = useSuccess ? theme.colorSuccessText : theme.colorErrorText;
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
    () =>
      [
        {
          defaultSymbol: '#',
          value: prevNumber,
          tooltipText: t('Data for %s', comparisonRange || 'previous range'),
          columnKey: 'Previous value',
        },
        {
          defaultSymbol: '△',
          value: valueDifference,
          tooltipText: t('Value difference between the time periods'),
          columnKey: 'Delta',
        },
        {
          defaultSymbol: '%',
          value: percentDifferenceFormattedString,
          tooltipText: t('Percentage difference between the time periods'),
          columnKey: 'Percent change',
        },
      ].map(item => {
        const config = props.columnConfig?.[item.columnKey];
        return {
          ...item,
          symbol: config?.displayTypeIcon === false ? '' : item.defaultSymbol,
          label: config?.customColumnName || item.columnKey,
        };
      }),
    [
      comparisonRange,
      prevNumber,
      valueDifference,
      percentDifferenceFormattedString,
      props.columnConfig,
    ],
  );

  const visibleSymbols = SYMBOLS_WITH_VALUES.filter(
    symbol => props.columnConfig?.[symbol.columnKey]?.visible !== false,
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
            overflow: auto;
          `
        }
      >
        {showMetricName && metricName && (
          <MetricNameText metricNameFontSize={metricNameFontSize}>
            {metricName}
          </MetricNameText>
        )}

        <div css={bigValueContainerStyles}>
          {bigNumber}
          {percentDifferenceNumber !== 0 && (
            <span css={arrowIndicatorStyle}>
              {percentDifferenceNumber > 0 ? '↑' : '↓'}
            </span>
          )}
        </div>
        {subtitle && (
          <SubtitleText
            style={{
              fontSize: `${subtitleFontSize * height * 0.4}px`,
            }}
          >
            {subtitle}
          </SubtitleText>
        )}

        {visibleSymbols.length > 0 && (
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
            {visibleSymbols.map((symbol_with_value, index) => (
              <ComparisonValue
                key={`comparison-symbol-${symbol_with_value.columnKey}`}
                subheaderFontSize={subheaderFontSize}
              >
                <Tooltip
                  id="tooltip"
                  placement="top"
                  title={symbol_with_value.tooltipText}
                >
                  {symbol_with_value.symbol && (
                    <SymbolWrapper
                      backgroundColor={
                        index > 0 ? backgroundColor : defaultBackgroundColor
                      }
                      textColor={index > 0 ? textColor : defaultTextColor}
                    >
                      {symbol_with_value.symbol}
                    </SymbolWrapper>
                  )}
                  {symbol_with_value.value}{' '}
                  {props.columnConfig?.[symbol_with_value.columnKey]
                    ?.customColumnName || ''}
                </Tooltip>
              </ComparisonValue>
            ))}
          </div>
        )}
      </NumbersContainer>
    </div>
  );
}
