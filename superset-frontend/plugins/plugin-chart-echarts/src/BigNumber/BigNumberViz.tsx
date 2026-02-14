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
import { useRef } from 'react';
import { t } from '@apache-superset/core';
import {
  getNumberFormatter,
  getTimeFormatter,
  SMART_DATE_VERBOSE_ID,
  computeMaxFontSize,
  BRAND_COLOR,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import Echart from '../components/Echart';
import { BigNumberVizProps } from './types';

const defaultNumberFormatter = getNumberFormatter();

const PROPORTION = {
  METRIC_NAME: 0.125,
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  TRENDLINE: 0.3,
};

function BigNumberVis({
  className = '',
  headerFormatter = defaultNumberFormatter,
  formatTime = getTimeFormatter(SMART_DATE_VERBOSE_ID),
  headerFontSize = PROPORTION.HEADER,
  kickerFontSize = PROPORTION.KICKER,
  metricNameFontSize = PROPORTION.METRIC_NAME,
  showMetricName = true,
  mainColor = BRAND_COLOR,
  showTimestamp = false,
  showTrendLine = false,
  startYAxisAtZero = true,
  subheader = '',
  subheaderFontSize = PROPORTION.SUBHEADER,
  subtitleFontSize = PROPORTION.SUBHEADER,
  alignment = 'center',
  ...props
}: BigNumberVizProps) {
  const metricNameRef = useRef<HTMLDivElement>(null);
  const kickerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const subheaderRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  const getClassName = () => {
    const names = `superset-legacy-chart-big-number ${className} ${
      props.bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    return showTrendLine ? names : `${names} no-trendline`;
  };

  const createTemporaryContainer = () => {
    const container = document.createElement('div');
    container.className = getClassName();
    container.style.position = 'absolute';
    container.style.opacity = '0';
    return container;
  };

  const renderFallbackWarning = () => {
    const { bigNumberFallback } = props;
    if (!formatTime || !bigNumberFallback || showTimestamp) return null;

    return (
      <span
        className="alert alert-warning"
        role="alert"
        title={t(
          'Last available value seen on %s',
          formatTime(bigNumberFallback[0] as number | Date),
        )}
      >
        {t('Not up to date')}
      </span>
    );
  };

  const renderMetricName = (maxHeight: number) => {
    const { metricName, width } = props;
    if (!showMetricName || !metricName) return null;

    const container = createTemporaryContainer();
    document.body.append(container);

    const fontSize = computeMaxFontSize({
      text: metricName,
      maxWidth: width,
      maxHeight,
      className: 'metric-name',
      container,
    });

    container.remove();

    return (
      <div ref={metricNameRef} className="metric-name" style={{ fontSize }}>
        {metricName}
      </div>
    );
  };

  const renderKicker = (maxHeight: number) => {
    const { timestamp, width } = props;
    if (!formatTime || !showTimestamp || timestamp == null) return null;

    const text = formatTime(timestamp as number | Date);

    const container = createTemporaryContainer();
    document.body.append(container);

    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'kicker',
      container,
    });

    container.remove();

    return (
      <div ref={kickerRef} className="kicker" style={{ fontSize }}>
        {text}
      </div>
    );
  };

  const renderHeader = (maxHeight: number) => {
    const { bigNumber, width } = props;

    const text =
      bigNumber == null
        ? t('No data')
        : typeof bigNumber === 'number'
        ? headerFormatter(bigNumber)
        : String(bigNumber);

    const container = createTemporaryContainer();
    document.body.append(container);

    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width * 0.9,
      maxHeight,
      className: 'header-line',
      container,
    });

    container.remove();

    return (
      <div ref={headerRef} className="header-line" style={{ fontSize }}>
        {text}
      </div>
    );
  };

  const renderSubheader = (maxHeight: number) =>
    subheader ? (
      <div
        ref={subheaderRef}
        className="subheader-line"
        style={{ fontSize: `${maxHeight}px` }}
      >
        {subheader}
      </div>
    ) : null;

  const renderSubtitle = (maxHeight: number) =>
    props.subtitle ? (
      <div
        ref={subtitleRef}
        className="subtitle-line"
        style={{ fontSize: `${maxHeight}px` }}
      >
        {props.subtitle}
      </div>
    ) : null;

  const { height } = props;

  const alignmentStyles = {
    alignItems:
      alignment === 'center'
        ? 'center'
        : alignment === 'right'
        ? 'flex-end'
        : 'flex-start',
    textAlign: alignment as 'left' | 'center' | 'right',
  };

  if (showTrendLine) {
    const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
    const allTextHeight = height - chartHeight;

    return (
      <div className={getClassName()}>
        <div
          className="text-container"
          style={{ height: allTextHeight, ...alignmentStyles }}
        >
          {renderFallbackWarning()}
          {renderMetricName(metricNameFontSize * height)}
          {renderKicker(kickerFontSize * height)}
          {renderHeader(headerFontSize * height)}
          {renderSubheader(subheaderFontSize * height)}
          {renderSubtitle(subtitleFontSize * height)}
        </div>

        <Echart
          {...props}
          height={chartHeight}
          echartOptions={props.echartOptions ?? {}}
        />
      </div>
    );
  }

  return (
    <div className={getClassName()} style={{ height }}>
      <div className="text-container" style={alignmentStyles}>
        {renderFallbackWarning()}
        {renderMetricName(metricNameFontSize * height)}
        {renderKicker(kickerFontSize * height)}
        {renderHeader(headerFontSize * height)}
        {renderSubheader(subheaderFontSize * height)}
        {renderSubtitle(subtitleFontSize * height)}
      </div>
    </div>
  );
}

export default styled(BigNumberVis)`
  ${({ theme }) => `
    font-family: ${theme.fontFamily};
    display: flex;
    flex-direction: column;

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  `}
`;
