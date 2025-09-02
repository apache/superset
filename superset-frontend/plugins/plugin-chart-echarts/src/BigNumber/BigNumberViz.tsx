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
import { PureComponent, MouseEvent } from 'react';
import {
  t,
  getNumberFormatter,
  getTimeFormatter,
  SMART_DATE_VERBOSE_ID,
  computeMaxFontSize,
  BRAND_COLOR,
  styled,
  BinaryQueryObjectFilterClause,
  NumberFormats,
} from '@superset-ui/core';
import Echart from '../components/Echart';
import { BigNumberVizProps } from './types';
import { EventHandlers } from '../types';

const defaultNumberFormatter = getNumberFormatter();

const PROPORTION = {
  // text size: proportion of the chart container sans trendline
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  // trendline size: proportion of the whole chart container
  TRENDLINE: 0.3,
};

class BigNumberVis extends PureComponent<BigNumberVizProps> {
  static defaultProps = {
    className: '',
    headerFormatter: defaultNumberFormatter,
    formatTime: getTimeFormatter(SMART_DATE_VERBOSE_ID),
    headerFontSize: PROPORTION.HEADER,
    kickerFontSize: PROPORTION.KICKER,
    mainColor: BRAND_COLOR,
    showTimestamp: false,
    showTrendLine: false,
    startYAxisAtZero: true,
    subheader: '',
    subheaderFontSize: PROPORTION.SUBHEADER,
    timeRangeFixed: false,
  };

  componentDidMount() {
    // Comprehensive debug logging for component mounting
    console.group('🎯 BigNumberViz componentDidMount - DATA ARRIVAL CHECK');
    console.log('📦 All Props Received:', {
      allPropKeys: Object.keys(this.props),
      propsCount: Object.keys(this.props).length,
    });

    console.log('🔢 Big Number Data:', {
      bigNumber: this.props.bigNumber,
      bigNumberType: typeof this.props.bigNumber,
      hasBigNumber:
        this.props.bigNumber !== undefined && this.props.bigNumber !== null,
    });

    console.log('📊 Comparison Data Arrival Check:', {
      percentageChange: this.props.percentageChange,
      percentageChangeType: typeof this.props.percentageChange,
      hasPercentageChange: this.props.percentageChange !== undefined,
      comparisonIndicator: this.props.comparisonIndicator,
      comparisonIndicatorType: typeof this.props.comparisonIndicator,
      hasComparisonIndicator: this.props.comparisonIndicator !== undefined,
      previousPeriodValue: (this.props as any).previousPeriodValue,
      hasPreviousPeriodValue:
        (this.props as any).previousPeriodValue !== undefined,
    });

    console.log('📋 Form Data Check:', {
      hasFormData: !!this.props.formData,
      formDataKeys: this.props.formData ? Object.keys(this.props.formData) : [],
      timeCompare: this.props.formData?.time_compare,
      extraFormData: this.props.formData?.extra_form_data,
      extraFormDataKeys: this.props.formData?.extra_form_data
        ? Object.keys(this.props.formData.extra_form_data)
        : [],
      extraTimeCompare: (this.props.formData?.extra_form_data as any)
        ?.time_compare,
      customFormData: this.props.formData?.extra_form_data?.custom_form_data,
      customTimeCompare: (
        this.props.formData?.extra_form_data?.custom_form_data as any
      )?.time_compare,
    });

    console.log('🎯 Comparison Ready Status:', {
      hasAllRequiredData:
        this.props.percentageChange !== undefined &&
        this.props.comparisonIndicator !== undefined,
      shouldRenderIndicator:
        this.props.percentageChange !== undefined &&
        this.props.comparisonIndicator !== undefined,
      missingData: {
        percentageChange: this.props.percentageChange === undefined,
        comparisonIndicator: this.props.comparisonIndicator === undefined,
      },
    });

    console.groupEnd();
  }

  componentDidUpdate(prevProps: BigNumberVizProps) {
    // Log when props change to track updates
    const currentComparison = {
      percentageChange: this.props.percentageChange,
      comparisonIndicator: this.props.comparisonIndicator,
    };

    const prevComparison = {
      percentageChange: prevProps.percentageChange,
      comparisonIndicator: prevProps.comparisonIndicator,
    };

    if (JSON.stringify(currentComparison) !== JSON.stringify(prevComparison)) {
      console.group('🔄 BigNumberViz componentDidUpdate - PROPS CHANGED');
      console.log('Previous comparison props:', prevComparison);
      console.log('New comparison props:', currentComparison);
      console.log('Change detected:', {
        percentageChangeChanged:
          this.props.percentageChange !== prevProps.percentageChange,
        comparisonIndicatorChanged:
          this.props.comparisonIndicator !== prevProps.comparisonIndicator,
      });
      console.groupEnd();
    }
  }

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
    if (!formatTime || !bigNumberFallback || showTimestamp) return null;
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
    if (
      !formatTime ||
      !showTimestamp ||
      typeof timestamp === 'string' ||
      typeof timestamp === 'boolean'
    )
      return null;

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
          height: 'auto',
        }}
      >
        {text}
      </div>
    );
  }

  renderComparisonIndicator() {
    const {
      percentageChange,
      comparisonIndicator,
      formData,
      comparisonPeriodText: propComparisonPeriodText,
    } = this.props;

    // Comprehensive debug logging
    console.group(
      '🔍 BigNumberViz renderComparisonIndicator - COMPREHENSIVE DEBUG',
    );
    console.log('📊 Comparison Data:', {
      percentageChange,
      comparisonIndicator,
      propComparisonPeriodText,
      percentageChangeType: typeof percentageChange,
      comparisonIndicatorType: typeof comparisonIndicator,
    });

    console.log('📋 FormData Analysis:', {
      hasFormData: !!formData,
      formDataKeys: formData ? Object.keys(formData) : [],
      timeCompare: formData?.time_compare,
      extraFormData: formData?.extra_form_data,
      extraFormDataKeys: formData?.extra_form_data
        ? Object.keys(formData.extra_form_data)
        : [],
      extraTimeCompare: (formData?.extra_form_data as any)?.time_compare,
      customFormData: formData?.extra_form_data?.custom_form_data,
      customTimeCompare: (formData?.extra_form_data?.custom_form_data as any)
        ?.time_compare,
    });

    console.log('🎯 All Props Analysis:', {
      allPropKeys: Object.keys(this.props),
      bigNumber: this.props.bigNumber,
      previousPeriodValue: (this.props as any).previousPeriodValue,
      hasPercentageChange: 'percentageChange' in this.props,
      hasComparisonIndicator: 'comparisonIndicator' in this.props,
    });

    if (percentageChange === undefined || comparisonIndicator === undefined) {
      console.error(
        '❌ BigNumberViz: Not rendering comparison indicator - missing required data',
      );
      console.log('Missing data details:', {
        percentageChange:
          percentageChange === undefined ? 'UNDEFINED' : percentageChange,
        comparisonIndicator:
          comparisonIndicator === undefined ? 'UNDEFINED' : comparisonIndicator,
      });
      console.groupEnd();
      return null;
    }

    console.log('✅ All required data present - proceeding with rendering');
    console.groupEnd();

    const formatPercentChange = getNumberFormatter(
      NumberFormats.PERCENT_SIGNED_1_POINT,
    );

    let indicatorColor: string;
    let arrowIcon: string;

    switch (comparisonIndicator) {
      case 'positive':
        indicatorColor = '#28a745'; // green
        arrowIcon = '↗';
        break;
      case 'negative':
        indicatorColor = '#dc3545'; // red
        arrowIcon = '↘';
        break;
      case 'neutral':
        indicatorColor = '#ffc107'; // orange
        arrowIcon = '−';
        break;
      default:
        return null;
    }

    // Use prop comparison period text if provided, otherwise generate from formData
    let comparisonPeriodText = propComparisonPeriodText;

    if (!comparisonPeriodText) {
      const timeCompare = (formData?.extra_form_data as any)?.time_compare;

      if (timeCompare === 'inherit') {
        comparisonPeriodText = t('vs previous period');
      } else if (timeCompare) {
        comparisonPeriodText = t('vs %s', timeCompare);
      }
    }

    // Generate a cleaner tooltip text with specific date ranges when possible
    let tooltipText = 'Period-over-period comparison';
    if (comparisonPeriodText) {
      // Remove 'vs' prefix if present since we'll add 'Compared to'
      const cleanText = comparisonPeriodText.replace(/^vs\s+/, '');
      
      // Handle special cases for better user experience
      if (cleanText === 'inherit' || cleanText === 'previous period') {
        // For inherit mode, try to show specific date range if available
        const timeRange = formData?.time_range;
        const since = formData?.since;
        const until = formData?.until;
        
        if (since && until) {
          // Format the actual date range for inherit mode
          const currentStart = new Date(since).toLocaleDateString();
          const currentEnd = new Date(until).toLocaleDateString();
          
          // Calculate previous period dates
          const currentStartDate = new Date(since);
          const currentEndDate = new Date(until);
          const duration = currentEndDate.getTime() - currentStartDate.getTime();
          
          const previousStartDate = new Date(currentStartDate.getTime() - duration);
          const previousEndDate = new Date(currentEndDate.getTime() - duration);
          
          const previousStart = previousStartDate.toLocaleDateString();
          const previousEnd = previousEndDate.toLocaleDateString();
          
          tooltipText = `Compared to ${previousStart} - ${previousEnd}`;
        } else if (timeRange && typeof timeRange === 'string') {
          // Use time range string to generate more specific text
          tooltipText = `Compared to previous ${timeRange.toLowerCase().replace('last ', '')}`;
        } else {
          tooltipText = 'Compared to previous period';
        }
      } else if (cleanText === 'custom_range') {
        tooltipText = 'Compared to custom date range';
      } else {
        tooltipText = `Compared to ${cleanText}`;
      }
    }

    const comparisonElement = (
      <div
        className="comparison-indicator"
        style={{
          position: 'absolute',
          top: '-35px', // Position above chart to appear in header area
          right: '60px', // Position left of controls menu
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: 'clamp(8px, 2.0vw, 14px)', // Responsive font size
          fontWeight: '500',
          color: indicatorColor,
          cursor: 'help',
          zIndex: 10, // Ensure it's above other elements
          whiteSpace: 'nowrap', // Prevent text wrapping on small screens
        }}
        title={tooltipText}
      >
        <span style={{ fontSize: 'inherit' }}>{arrowIcon}</span>
        <span>
          {Number.isNaN(percentageChange) || percentageChange === undefined 
            ? '0%' 
            : formatPercentChange(percentageChange)
          }
        </span>
      </div>
    );

    console.log('✅ Successfully created comparison indicator element:', {
      elementCreated: true,
      indicatorColor,
      arrowIcon,
      formattedPercentage: formatPercentChange(percentageChange),
      comparisonPeriodText,
      elementHTML: comparisonElement,
    });

    return comparisonElement;
  }

  renderHeader(maxHeight: number) {
    const { bigNumber, headerFormatter, width, colorThresholdFormatters } =
      this.props;
    // @ts-ignore
    const text = bigNumber === null ? '0' : headerFormatter(bigNumber);

    const hasThresholdColorFormatter =
      Array.isArray(colorThresholdFormatters) &&
      colorThresholdFormatters.length > 0;

    let numberColor;
    if (hasThresholdColorFormatter) {
      colorThresholdFormatters!.forEach(formatter => {
        const formatterResult = bigNumber
          ? formatter.getColorFromValue(bigNumber as number)
          : false;
        if (formatterResult) {
          numberColor = formatterResult;
        }
      });
    } else {
      numberColor = 'black';
    }

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width * 0.9, // reduced it's max width
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
      if (this.props.onContextMenu) {
        e.preventDefault();
        this.props.onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
      }
    };

    return (
      <div
        className="header-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize,
          height: 'auto',
          color: numberColor,
        }}
        onContextMenu={onContextMenu}
      >
        {text}
      </div>
    );
  }

  renderSubheader(maxHeight: number) {
    const { bigNumber, subheader, width, bigNumberFallback } = this.props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t('NO_DATA_OR_HASNT_LANDED');
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
        maxWidth: width * 0.9, // max width reduced
        maxHeight,
        className: 'subheader-line',
        container,
      });
      container.remove();

      return text === 'NO_DATA_OR_HASNT_LANDED' ? null : (
        <div
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
          }}
        >
          {text}
        </div>
      );
    }
    return null;
  }

  renderTrendline(maxHeight: number) {
    const { width, trendLineData, echartOptions, refs } = this.props;

    // if can't find any non-null values, no point rendering the trendline
    if (!trendLineData?.some(d => d[1] !== null)) {
      return null;
    }

    const eventHandlers: EventHandlers = {
      contextmenu: eventParams => {
        if (this.props.onContextMenu) {
          eventParams.event.stop();
          const { data } = eventParams;
          if (data) {
            const pointerEvent = eventParams.event.event;
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            drillToDetailFilters.push({
              col: this.props.formData?.granularitySqla,
              grain: this.props.formData?.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: this.props.xValueFormatter?.(data[0]),
            });
            this.props.onContextMenu(
              pointerEvent.clientX,
              pointerEvent.clientY,
              { drillToDetail: drillToDetailFilters },
            );
          }
        }
      },
    };

    return (
      echartOptions && (
        <Echart
          refs={refs}
          width={Math.floor(width)}
          height={maxHeight}
          echartOptions={echartOptions}
          eventHandlers={eventHandlers}
        />
      )
    );
  }

  render() {
    const {
      showTrendLine,
      height,
      kickerFontSize,
      headerFontSize,
      subheaderFontSize,
    } = this.props;
    const className = this.getClassName();

    // Log render attempts
    console.group('🎨 BigNumberViz render - RENDER ATTEMPT');
    console.log('🖼️ Render Context:', {
      showTrendLine,
      height,
      className,
      componentType: showTrendLine ? 'with-trendline' : 'no-trendline',
    });

    console.log('🎯 Comparison Render Check:', {
      percentageChange: this.props.percentageChange,
      comparisonIndicator: this.props.comparisonIndicator,
      willRenderComparison:
        this.props.percentageChange !== undefined &&
        this.props.comparisonIndicator !== undefined,
      comparisonMethod: 'renderComparisonIndicator()',
    });
    console.groupEnd();

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;

      const comparisonIndicator = this.renderComparisonIndicator();
      console.log('📊 Trendline render - Comparison indicator result:', {
        comparisonIndicator,
        isNull: comparisonIndicator === null,
        hasContent: !!comparisonIndicator,
      });

      return (
        <div className={className} style={{ position: 'relative' }}>
          {comparisonIndicator}
          <div className="text-container" style={{ height: allTextHeight }}>
            {this.renderFallbackWarning()}
            {this.renderKicker(
              Math.ceil(
                (kickerFontSize || 0) * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
            {this.renderHeader(
              Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height),
            )}
            {this.renderSubheader(
              Math.ceil(
                subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
          </div>
          {this.renderTrendline(chartHeight)}
        </div>
      );
    }

    const comparisonIndicator = this.renderComparisonIndicator();
    console.log('📊 No-trendline render - Comparison indicator result:', {
      comparisonIndicator,
      isNull: comparisonIndicator === null,
      hasContent: !!comparisonIndicator,
    });

    return (
      <div className={className} style={{ height, position: 'relative' }}>
        {comparisonIndicator}
        {this.renderFallbackWarning()}
        {this.renderKicker((kickerFontSize || 0) * height)}
        {this.renderHeader(Math.ceil(headerFontSize * height))}
        {this.renderSubheader(Math.ceil(subheaderFontSize * height))}
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
    align-items: flex-start;

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
      white-space: nowrap;
      margin-bottom:${theme.gridUnit * 2}px;
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

    .comparison-indicator {
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      &:hover {
        transform: scale(1.05);
        transition: transform 0.2s ease;
      }
    }
  `}
`;
