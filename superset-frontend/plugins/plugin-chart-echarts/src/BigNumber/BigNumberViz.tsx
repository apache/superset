// DODO was here
import React from 'react';
import {
  t,
  getNumberFormatter,
  NumberFormatter,
  smartDateVerboseFormatter,
  TimeFormatter,
  computeMaxFontSize,
  BRAND_COLOR,
  POSITIVE_COLOR,
  NAGATIVE_COLOR,
  styled,
} from '@superset-ui/core';
import { EChartsCoreOption } from 'echarts';
import { TimeSeriesDatum, ConditionalFormattingConfig } from './types';
import {
  PROPORTION,
  NO_DATA_OR_HASNT_LANDED,
  NO_DATA,
  DEFAULT_COLOR,
} from './constants';
import { calculateColor, getColors } from './utils';
import Echart from '../components/Echart';

const defaultNumberFormatter = getNumberFormatter();

type BigNumberVisProps = {
  className?: string;
  width: number;
  height: number;
  bigNumber?: number | null;
  bigNumberFallback?: TimeSeriesDatum;
  headerFormatter: NumberFormatter | TimeFormatter;
  formatTime: TimeFormatter;
  headerFontSize: number;
  kickerFontSize: number;
  subheader: string;
  comparison: string;
  subheaderFontSize: number;
  showTimestamp?: boolean;
  showTrendLine?: boolean;
  startYAxisAtZero?: boolean;
  timeRangeFixed?: boolean;
  timestamp?: number;
  trendLineData?: TimeSeriesDatum[];
  mainColor: string;
  positiveColor: string;
  negativeColor: string;
  echartOptions: EChartsCoreOption;
  conditionalFormatting: ConditionalFormattingConfig[];
};

class BigNumberVis extends React.PureComponent<BigNumberVisProps> {
  static defaultProps = {
    className: '',
    headerFormatter: defaultNumberFormatter,
    formatTime: smartDateVerboseFormatter,
    headerFontSize: PROPORTION.HEADER,
    kickerFontSize: PROPORTION.KICKER,
    mainColor: BRAND_COLOR,
    positiveColor: POSITIVE_COLOR,
    negativeColor: NAGATIVE_COLOR,
    showTimestamp: false,
    showTrendLine: false,
    startYAxisAtZero: true,
    subheader: '',
    comparison: '',
    subheaderFontSize: PROPORTION.SUBHEADER,
    timeRangeFixed: false,
    conditionalFormatting: [] as ConditionalFormattingConfig[],
  };

  getClassName() {
    const { className, showTrendLine, bigNumberFallback } = this.props;
    const names = `superset-legacy-chart-big-number ${className} ${
      bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    if (showTrendLine) return names;
    return `${names} no-trendline`;
  }

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = this.getClassName();
    container.style.position = 'absolute'; // so it won't disrupt page layout
    container.style.opacity = '0'; // and not visible
    return container;
  }

  renderFallbackWarning() {
    const { bigNumberFallback, formatTime, showTimestamp } = this.props;
    if (!bigNumberFallback || showTimestamp) return null;
    return (
      <span
        className="alert alert-warning"
        role="alert"
        title={t(
          `Last available value seen on %s`,
          formatTime(bigNumberFallback[0]),
        )}
      >
        {t('Not up to date')}
      </span>
    );
  }

  renderKicker(maxHeight: number) {
    const { timestamp, showTimestamp, formatTime, width } = this.props;
    if (!showTimestamp) return null;

    const text = timestamp === null ? '' : formatTime(timestamp);

    const container = this.createTemporaryContainer();
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
      <div
        className="kicker"
        style={{
          fontSize,
          height: maxHeight,
        }}
      >
        {text}
      </div>
    );
  }

  renderHeader(maxHeight: number, textColor: string) {
    const { bigNumber, headerFormatter, width } = this.props;
    const text = bigNumber === null ? t('No data') : headerFormatter(bigNumber);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width - 8, // Decrease 8px for more precise font size
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    return (
      <div
        className="header-line"
        style={{
          fontSize,
          height: maxHeight,
          color: textColor,
        }}
      >
        {text}
      </div>
    );
  }

  renderSubheader(maxHeight: number, textColor: string) {
    const { bigNumber, subheader, width, bigNumberFallback } = this.props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t(
      'No data after filtering or data is NULL for the latest time record',
    );
    const NO_DATA = t(
      'Try applying different filters or ensuring your datasource has data',
    );
    let text = subheader;
    if (bigNumber === null) {
      text = bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED;
    }

    if (text) {
      const container = this.createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width,
        maxHeight,
        className: 'subheader-line',
        container,
      });
      container.remove();

      return (
        <div
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
            color: textColor,
          }}
        >
          {text}
        </div>
      );
    }
    return null;
  }

  renderComparison(maxHeight: number) {
    const {
      bigNumber,
      comparison,
      width,
      bigNumberFallback,
      className,
      positiveColor,
      negativeColor,
    } = this.props;
    let fontSize = 0;

    let text = comparison;
    if (bigNumber === null) {
      text = bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED;
    }

    if (text) {
      const container = this.createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width,
        maxHeight,
        className: 'subheader-line',
        container,
      });
      container.remove();

      return (
        <div
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
            color: calculateColor(className, positiveColor, negativeColor),
            marginTop: '50px',
          }}
        >
          {text}
        </div>
      );
    }
    return null;
  }

  renderTrendline(maxHeight: number) {
    const { width, trendLineData, echartOptions } = this.props;

    // if can't find any non-null values, no point rendering the trendline
    if (!trendLineData?.some(d => d[1] !== null)) {
      return null;
    }

    return (
      <Echart
        width={Math.floor(width)}
        height={maxHeight}
        echartOptions={echartOptions}
      />
    );
  }

  render() {
    const {
      showTrendLine,
      height,
      kickerFontSize,
      headerFontSize,
      subheaderFontSize,
      conditionalFormatting,
      bigNumber,
    } = this.props;

    const allColors = getColors(conditionalFormatting, bigNumber);
    const finalColors = allColors.filter(color => color !== DEFAULT_COLOR);
    const finalColor = !finalColors.length
      ? DEFAULT_COLOR
      : finalColors[finalColors.length - 1];

    const textColor: string = finalColor;
    const className = this.getClassName();

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;

      return (
        <div className={className}>
          <div className="text-container" style={{ height: allTextHeight }}>
            {this.renderFallbackWarning()}
            {this.renderKicker(
              Math.ceil(kickerFontSize * (1 - PROPORTION.TRENDLINE) * height),
            )}
            {this.renderHeader(
              Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height),
              textColor,
            )}
            {this.renderSubheader(
              Math.ceil(
                subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height,
              ),
              textColor,
            )}
            {this.renderComparison(
              Math.ceil(
                subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
          </div>
          {this.renderTrendline(chartHeight)}
        </div>
      );
    }

    return (
      <div className={className} style={{ height }}>
        {this.renderFallbackWarning()}
        {this.renderKicker(kickerFontSize * height)}
        {this.renderHeader(Math.ceil(headerFontSize * height), textColor)}
        {this.renderSubheader(Math.ceil(subheaderFontSize * height), textColor)}
        {this.renderComparison(Math.ceil(subheaderFontSize * height))}
      </div>
    );
  }
}

export default styled(BigNumberVis)`
  ${({ theme }) => `
    font-family: ${theme.typography.families.sansSerif};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;

    &.no-trendline .subheader-line {
      padding-bottom: 0.3em;
    }

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      .alert {
        font-size: ${theme.typography.sizes.s};
        margin: -0.5em 0 0.4em;
        line-height: 1;
        padding: ${theme.gridUnit}px;
        border-radius: ${theme.gridUnit}px;
      }
    }

    .kicker {
      line-height: 1em;
      padding-bottom: 2em;
    }

    .header-line {
      position: relative;
      line-height: 1em;
      span {
        position: absolute;
        bottom: 0;
      }
    }

    .subheader-line {
      line-height: 1em;
      padding-bottom: 0;
    }

    &.is-fallback-value {
      .kicker,
      .header-line,
      .subheader-line {
        opacity: ${theme.opacity.mediumHeavy};
      }
    }
  `}
`;
