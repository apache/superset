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

/**
 * BigNumber Glyph - Single-File Visualization Plugin
 *
 * This is the Glyph pattern implementation of BigNumber:
 * - Arguments define BOTH the controls AND render props
 * - No controlPanel.ts, transformProps.ts, or buildQuery.ts needed
 * - Just define arguments + render function = complete plugin
 *
 * Feature parity with BigNumberTotal:
 * - Number formatting (D3 formats)
 * - Currency formatting
 * - Time/date formatting
 * - Conditional color formatting
 * - Metric name display
 * - Subtitle display
 */

import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  Behavior,
  getNumberFormatter,
  CurrencyFormatter,
  getTimeFormatter,
  DataRecord,
} from '@superset-ui/core';
import {
  getColorFormatters,
  ConditionalFormattingConfig,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  NumberFormat,
  Currency,
  TimeFormat,
  ConditionalFormatting,
  // Presets - reusable argument configurations
  HeaderFontSize,
  SubheaderFontSize,
  Subtitle,
  ForceTimestampFormatting,
  ShowMetricName,
  MetricNameFontSize,
} from '@superset-ui/glyph-core';

import thumbnail from '../BigNumberTotal/images/thumbnail.png';
import example1 from '../BigNumberTotal/images/BigNumber.jpg';
import example1Dark from '../BigNumberTotal/images/BigNumber-dark.jpg';
import example2 from '../BigNumberTotal/images/BigNumber2.jpg';
import example2Dark from '../BigNumberTotal/images/BigNumber2-dark.jpg';

// ============================================================================
// Styled components for the chart
// ============================================================================

const Container = styled.div<{ height: number }>`
  ${({ theme, height }) => `
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: ${height}px;
    padding: ${theme.sizeUnit * 4}px;
    font-family: ${theme.fontFamily};
  `}
`;

const BigNumberText = styled.div<{ fontSize: number; color?: string }>`
  ${({ theme, fontSize, color }) => `
    font-size: ${fontSize}px;
    font-weight: ${theme.fontWeightNormal};
    line-height: 1;
    color: ${color || theme.colorText};
  `}
`;

const MetricName = styled.div<{ fontSize: number }>`
  ${({ theme, fontSize }) => `
    font-size: ${fontSize}px;
    color: ${theme.colorTextTertiary};
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const SubtitleText = styled.div<{ fontSize: number }>`
  ${({ theme, fontSize }) => `
    font-size: ${fontSize}px;
    color: ${theme.colorTextTertiary};
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

// ============================================================================
// THE CHART DEFINITION - This is ALL you need!
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Big Number'),
    description: t(
      'Showcases a single metric front-and-center. Big number is best used to call ' +
        'attention to a KPI or the one thing you want your audience to focus on.',
    ),
    category: t('KPI'),
    tags: [
      t('Additive'),
      t('Business'),
      t('Percentages'),
      t('Featured'),
      t('Report'),
    ],
    thumbnail,
    behaviors: [Behavior.DrillToDetail],
    exampleGallery: [
      { url: example1, urlDark: example1Dark, caption: t('A Big Number') },
      { url: example2, urlDark: example2Dark, caption: t('With a subheader') },
    ],
  },

  // Arguments define BOTH the control panel AND the props passed to render
  // NOTE: Use camelCase - Superset converts snake_case to camelCase in formData
  arguments: {
    metric: Metric.with({ label: t('Metric') }),

    headerFontSize: HeaderFontSize,

    subtitle: Subtitle,

    subtitleFontSize: SubheaderFontSize,

    showMetricName: ShowMetricName,

    metricNameFontSize: {
      arg: MetricNameFontSize,
      visibleWhen: { showMetricName: true },
    },

    numberFormat: NumberFormat,

    currencyFormat: Currency,

    timeFormat: TimeFormat,

    forceTimestampFormatting: ForceTimestampFormatting,

    conditionalFormatting: ConditionalFormatting,
  },

  // The render function receives argument values directly - no transformation needed!
  render: ({
    metric,
    headerFontSize,
    subtitle,
    subtitleFontSize,
    showMetricName,
    metricNameFontSize,
    numberFormat,
    currencyFormat,
    timeFormat,
    forceTimestampFormatting,
    conditionalFormatting,
    height,
    data,
    theme,
  }) => {
    // Determine if we should use time formatting
    // In a real implementation, we'd check the column type from the data
    const useTimeFormat = forceTimestampFormatting;

    // Create formatter based on format type
    let formattedValue: string;
    if (useTimeFormat && metric.value != null) {
      const timeFormatter = getTimeFormatter(timeFormat);
      formattedValue = timeFormatter(metric.value as Date);
    } else if (currencyFormat?.symbol) {
      const formatter = new CurrencyFormatter({
        currency: {
          symbol: currencyFormat.symbol,
          symbolPosition: currencyFormat.symbolPosition ?? 'prefix',
        },
        d3Format: numberFormat,
      });
      formattedValue =
        metric.value != null ? formatter(metric.value as number) : t('No data');
    } else {
      const formatter = getNumberFormatter(numberFormat);
      formattedValue =
        metric.value != null ? formatter(metric.value as number) : t('No data');
    }

    // Calculate conditional formatting color
    let numberColor: string | undefined;
    if (
      conditionalFormatting &&
      conditionalFormatting.length > 0 &&
      metric.value != null
    ) {
      const colorFormatters = getColorFormatters(
        conditionalFormatting as ConditionalFormattingConfig[],
        data as DataRecord[],
        theme as Record<string, unknown>,
        false,
      );
      if (colorFormatters) {
        for (const formatter of colorFormatters) {
          const color = formatter.getColorFromValue(metric.value as number);
          if (color) {
            numberColor = color;
            break;
          }
        }
      }
    }

    // Calculate font sizes based on container height
    const headerFontPx = Math.floor(height * (headerFontSize as number));
    const subtitleFontPx = Math.floor(height * (subtitleFontSize as number));
    const metricNameFontPx = Math.floor(
      height * (metricNameFontSize as number),
    );

    return (
      <Container height={height}>
        {showMetricName && metric.name && (
          <MetricName fontSize={metricNameFontPx}>{metric.name}</MetricName>
        )}
        <BigNumberText fontSize={headerFontPx} color={numberColor}>
          {formattedValue}
        </BigNumberText>
        {subtitle && (
          <SubtitleText fontSize={subtitleFontPx}>{subtitle}</SubtitleText>
        )}
      </Container>
    );
  },
});
