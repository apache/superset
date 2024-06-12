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
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

import React, { createRef, useMemo } from 'react';
import { formatNumber, styled, t } from '@superset-ui/core';
import cdf from '@stdlib/stats-base-dists-normal-cdf';
import { AvenABChartProps, AvenABChartStylesProps } from './types';
import TableView from '../../../src/components/TableView/TableView';
import sortNumericValues from '../../../src/utils/sortNumericValues';
import SparklineCell from '../../../src/visualizations/TimeTable/SparklineCell';
import FormattedNumber from '../../../src/visualizations/TimeTable/FormattedNumber';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

function standardNormalInverseCDF(p: number): number {
  const a0 = 2.50662823884;
  const a1 = -18.61500062529;
  const a2 = 41.39119773534;
  const a3 = -25.44106049637;
  const b1 = -8.4735109309;
  const b2 = 23.08336743743;
  const b3 = -21.06224101826;
  const b4 = 3.13082909833;
  const c0 = 0.3374754822726147;
  const c1 = 0.9761690190917186;
  const c2 = 0.1607979714918209;
  const c3 = 0.0276438810333863;
  const c4 = 0.0038405729373609;
  const c5 = 0.0003951896511919;
  const c6 = 0.0000321767881768;
  const c7 = 0.0000002888167364;
  const c8 = 0.0000003960315187;

  let x;
  if (p < 0 || p > 1) {
    throw new Error('Probability must be between 0 and 1');
  } else if (p === 0) {
    return -Infinity;
  } else if (p === 1) {
    return Infinity;
  }
  const r = p - 0.5;
  if (Math.abs(r) < 0.42) {
    x = r * r;
    return (
      (r * (((a3 * x + a2) * x + a1) * x + a0)) /
      ((((b4 * x + b3) * x + b2) * x + b1) * x + 1)
    );
  }
  x = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
  return (
    x -
    ((((c8 * x + c7) * x + c6) * x + c5) * x) /
      ((((c4 * x + c3) * x + c2) * x + c1) * x + c0)
  );
}

function getConfidenceInterval(
  conversionRate: number,
  trials: number,
  confidenceLevel: number,
) {
  // Calculate standard errors
  const se: number = Math.sqrt(
    (conversionRate * (1 - conversionRate)) / trials,
  );
  // Compute confidence intervals
  const zScoreConfidence = standardNormalInverseCDF(
    1 - (1 - confidenceLevel) / 2,
  );
  const errorMargin: number = zScoreConfidence * se;
  const lowerBound: number = Math.max(0, conversionRate - errorMargin);
  const upperBound: number = Math.min(1, conversionRate + errorMargin);
  return {
    lowerBound,
    upperBound,
  };
}

function calculatePValueTwoSidedCDF(
  successesControl: number,
  samplesControl: number,
  successesTest: number,
  samplesTest: number,
  confidenceIntervalLevel: number,
) {
  // Calculate conversion rates
  const conversionRateControl = successesControl / samplesControl;
  const conversionRateTest = successesTest / samplesTest;

  // Calculate pooled conversion rate
  const pooledConversionRate =
    (successesControl + successesTest) / (samplesControl + samplesTest);

  // Calculate pooled standard error
  const pooledStandardError = Math.sqrt(
    pooledConversionRate *
      (1 - pooledConversionRate) *
      (1 / samplesControl + 1 / samplesTest),
  );

  // Calculate Z-score
  const zScore =
    (conversionRateTest - conversionRateControl) / pooledStandardError;

  // Calculate P-value (two-sided)
  const pValue = 2 * (1 - cdf(Math.abs(zScore), 0, 1));

  const controlBounds = getConfidenceInterval(
    conversionRateControl,
    samplesControl,
    confidenceIntervalLevel,
  );
  const testBounds = getConfidenceInterval(
    conversionRateTest,
    samplesTest,
    confidenceIntervalLevel,
  );

  return {
    pValue,
    controlBounds,
    testBounds,
  };
}

const sortNumberWithMixedTypes = (
  rowA: any,
  rowB: any,
  columnId: number,
  descending: boolean,
) =>
  sortNumericValues(
    rowA.values[columnId].props['data-value'],
    rowB.values[columnId].props['data-value'],
    { descending, nanTreatment: 'asSmallest' },
  ) *
  // react-table sort function always expects -1 for smaller number
  (descending ? -1 : 1);

const TimeTableStyles = styled.div<AvenABChartStylesProps>`
  height: ${({ height }) => height}px;
  overflow: auto;
  th {
    z-index: 11 !important; // to cover sparkline
  }
  tbody {
    tr {
      td {
        padding: 1px;
      }
    }
  }
`;

const renderSparklineCell = (
  sparkData: (number | null)[],
  tooltip: React.ReactNode[],
  timestamps: { time: Date }[],
) => (
  <SparklineCell
    ariaLabel="spark"
    width={300}
    height={50}
    data={sparkData}
    dataKey="spark"
    dateFormat="%B %d, %Y"
    numberFormat="+.1%"
    showYAxis
    yAxisBounds={[undefined, undefined]}
    entries={timestamps}
    renderTooltip={e => tooltip[e.index]}
  />
);

function div0(a: any, b: any): number {
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) {
    return NaN;
  }
  return a / b;
}

function getRatioAndResultElement(num: number, den: number) {
  return (
    <div>
      <p style={{ fontSize: 'xx-small' }}>
        {formatNumber(',', num)} / {formatNumber(',', den)}
      </p>
      <p>{formatNumber('.1%', div0(num, den))}</p>
    </div>
  );
}

function getRatioAndResultElementForToolTip(num: number, den: number) {
  return (
    <p>
      {formatNumber(',', num)} / {formatNumber(',', den)} (
      {formatNumber('.1%', div0(num, den))})
    </p>
  );
}

function getIntervalBar(
  start: number,
  colorStart: number,
  tickMark: number,
  colorEnd: number,
  end: number,
) {
  const den = end - start;
  return (
    <div style={{ display: 'inline-flex', fontFamily: 'monospace' }}>
      <span>{formatNumber('.1f', 100 * colorStart)} &ensp;</span>
      <div
        style={{
          width: '100px',
          display: 'flex',
          height: '15px',
        }}
      >
        <div
          style={{
            width: `${(100 * (colorStart - start)) / den}%`,
            display: 'flex',
            backgroundColor: 'transparent',
          }}
        />
        <div
          style={{
            width: `${(100 * (tickMark - colorStart)) / den - 1}%`,
            display: 'flex',
            // eslint-disable-next-line theme-colors/no-literal-colors
            backgroundColor: 'gray',
          }}
        />
        <div
          style={{
            width: `2%`,
            display: 'flex',
            // eslint-disable-next-line theme-colors/no-literal-colors
            backgroundColor: 'black',
          }}
        />
        <div
          style={{
            width: `${(100 * (colorEnd - tickMark)) / den - 2}%`,
            display: 'flex',
            // eslint-disable-next-line theme-colors/no-literal-colors
            backgroundColor: 'gray',
          }}
        />
        <div
          style={{
            width: `${(100 * (end - colorEnd)) / den}%`,
            display: 'flex',
            backgroundColor: 'transparent',
          }}
        />
      </div>
      <span>&ensp;{formatNumber('.1f', 100 * colorEnd)}</span>
    </div>
  );
}

function getDelta(
  control: {}[],
  test: {}[],
  numeratorMetric: string,
  denominatorMetric: string,
): { numbers: (number | null)[]; tooltip: React.ReactNode[] } {
  const retNumbers: (number | null)[] = [];
  const retElements: React.ReactNode[] = [];

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < control.length; i++) {
    const testValue = div0(
      test[i][numeratorMetric],
      test[i][denominatorMetric],
    );
    const controlValue = div0(
      control[i][numeratorMetric],
      control[i][denominatorMetric],
    );
    if (
      controlValue === 0 ||
      Number.isNaN(testValue) ||
      Number.isNaN(controlValue)
    ) {
      retNumbers.push(null);
      retElements.push(<div />);
    } else {
      retNumbers.push((testValue - controlValue) / controlValue);
      retElements.push(
        <span style={{ fontSize: 'xx-small' }}>
          Control:
          {getRatioAndResultElementForToolTip(
            control[i][numeratorMetric] as number,
            control[i][denominatorMetric] as number,
          )}
          Test:
          {getRatioAndResultElementForToolTip(
            test[i][numeratorMetric] as number,
            test[i][denominatorMetric] as number,
          )}
        </span>,
      );
    }
  }
  return {
    numbers: retNumbers,
    tooltip: retElements,
  };
}

function buildRow(
  metricsControl: {}[],
  metricsTest: {}[],
  timestamps: { time: Date }[],
  numeratorMetric: string,
  denominatorMetric: string,
  confidenceIntervalLevel: number,
) {
  const lastControl = metricsControl.at(-1);
  const lastTest = metricsTest.at(-1);
  const deltaArray = getDelta(
    metricsControl,
    metricsTest,
    numeratorMetric,
    denominatorMetric,
  );
  const lastDelta = deltaArray.numbers.at(-1);
  if (
    lastControl === undefined ||
    lastTest === undefined ||
    lastDelta === undefined
  ) {
    throw new Error('empty arrays');
  }

  const color =
    lastDelta === null || (lastDelta > -0.00001 && lastDelta < 0.00001)
      ? 'black'
      : lastDelta < 0
        ? 'red'
        : 'green';

  const confidence = calculatePValueTwoSidedCDF(
    lastControl[numeratorMetric],
    lastControl[denominatorMetric],
    lastTest[numeratorMetric],
    lastTest[denominatorMetric],
    confidenceIntervalLevel,
  );

  const confidenceMin = Math.min(
    confidence.testBounds.lowerBound,
    confidence.controlBounds.lowerBound,
  );
  const confidenceMax = Math.max(
    confidence.testBounds.upperBound,
    confidence.controlBounds.upperBound,
  );

  return {
    metric: (
      <div style={{ fontSize: 'small' }}>
        <p>{numeratorMetric}</p>
        <p>
          &emsp;<b>/</b> {denominatorMetric}
        </p>
      </div>
    ),
    control: getRatioAndResultElement(
      lastControl[numeratorMetric] as number,
      lastControl[denominatorMetric] as number,
    ),
    test: getRatioAndResultElement(
      lastTest[numeratorMetric] as number,
      lastTest[denominatorMetric] as number,
    ),
    delta_abs: (
      <span style={{ color }}>
        <FormattedNumber
          num={
            100 *
            (div0(lastTest[numeratorMetric], lastTest[denominatorMetric]) -
              div0(
                lastControl[numeratorMetric],
                lastControl[denominatorMetric],
              ))
          }
          format="+.1f"
        />
      </span>
    ),
    delta_rel: (
      <span style={{ color }}>
        <FormattedNumber
          num={lastDelta !== null ? lastDelta : undefined}
          format="+.1%"
        />
      </span>
    ),
    spark: renderSparklineCell(
      deltaArray.numbers,
      deltaArray.tooltip,
      timestamps,
    ),
    p_value: (
      <div style={{ textAlign: 'center' }}>
        {formatNumber('.2f', 1 - confidence.pValue)}
      </div>
    ),
    confidence_interval_bar: (
      <div style={{ fontFamily: 'monospace', fontSize: 'small' }}>
        <div style={{ paddingBottom: '2px' }}>
          C:{' '}
          {getIntervalBar(
            confidenceMin,
            confidence.controlBounds.lowerBound,
            div0(lastControl[numeratorMetric], lastControl[denominatorMetric]),
            confidence.controlBounds.upperBound,
            confidenceMax,
          )}
        </div>
        <div>
          T:{' '}
          {getIntervalBar(
            confidenceMin,
            confidence.testBounds.lowerBound,
            div0(lastTest[numeratorMetric], lastTest[denominatorMetric]),
            confidence.testBounds.upperBound,
            confidenceMax,
          )}
        </div>
      </div>
    ),
  };
}

function getColumns(showPValue: boolean, showConfidenceIntervals: boolean) {
  const base = [
    { accessor: 'metric', Header: t('Metric') },
    {
      accessor: 'control',
      Header: t('Control'),
      sortType: sortNumberWithMixedTypes,
    },
    {
      accessor: 'test',
      Header: t('Test'),
      sortType: sortNumberWithMixedTypes,
    },
    {
      accessor: 'delta_abs',
      Header: t('Points'),
      sortType: sortNumberWithMixedTypes,
    },
    {
      accessor: 'delta_rel',
      Header: t('Delta'),
      sortType: sortNumberWithMixedTypes,
    },
    {
      accessor: 'spark',
      Header: t('Delta to Date'),
    },
  ];
  if (showPValue) {
    base.push({
      accessor: 'p_value',
      Header: t('1 - P-Value'),
    });
  }
  if (showConfidenceIntervals) {
    base.push({
      accessor: 'confidence_interval_bar',
      Header: t('Confidence Intervals'),
    });
  }
  return base;
}

export default function AvenABChart(props: AvenABChartProps) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const {
    height,
    width,
    metricsTest,
    metricsControl,
    allTimestamps,
    metricsNames,
    stepOverStep,
    showPValue,
    showConfidenceIntervals,
    confidenceIntervalLevel,
  } = props;
  const rootElem = createRef<HTMLDivElement>();

  const columns = useMemo(
    () => getColumns(showPValue, showConfidenceIntervals),
    [showPValue, showConfidenceIntervals],
  );

  const timestamps = allTimestamps.map(v => ({
    time: new Date(v),
  }));

  const rows = [];

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i < metricsNames.length; i++) {
    const numeratorMetric = metricsNames[i];
    const denominatorMetric = metricsNames[stepOverStep ? i - 1 : 0];

    rows.push(
      buildRow(
        metricsControl,
        metricsTest,
        timestamps,
        numeratorMetric,
        denominatorMetric,
        confidenceIntervalLevel,
      ),
    );
  }

  // last over first
  if (stepOverStep) {
    rows.push(
      buildRow(
        metricsControl,
        metricsTest,
        timestamps,
        metricsNames.at(-1) || 'make linter happy',
        metricsNames[0],
        confidenceIntervalLevel,
      ),
    );
  }

  return (
    <TimeTableStyles ref={rootElem} height={height} width={width}>
      <TableView
        className="table-no-hover"
        columns={columns}
        data={rows}
        withPagination={false}
      />
    </TimeTableStyles>
  );
}
