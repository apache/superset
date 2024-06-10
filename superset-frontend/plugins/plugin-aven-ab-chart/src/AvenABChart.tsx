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
import { formatNumber, styled, t } from '@superset-ui/core';
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
`;

const renderSparklineCell = (
  sparkData: (number | null)[],
  valueField: string,
  timestamps: { time: Date }[],
) => (
  <SparklineCell
    ariaLabel={`spark-${valueField}`}
    width={300}
    height={50}
    data={sparkData}
    dataKey={`spark-${valueField}`}
    dateFormat="%B %d, %Y"
    numberFormat=".1%"
    showYAxis
    yAxisBounds={[undefined, undefined]}
    entries={timestamps}
  />
);

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

function div0(a: any, b: any): number {
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) {
    return NaN;
  }
  return a / b;
}

function getDelta(
  control: {}[],
  test: {}[],
  numeratorMetric: string,
  denominatorMetric: string,
): (number | null)[] {
  const ret: (number | null)[] = [];

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
      ret.push(null);
    } else {
      ret.push((testValue - controlValue) / controlValue);
    }
  }
  return ret;
}

function getRatioAndResultElement(num: number, den: number) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 'xx-small' }}>
        {num} / {den}
      </p>
      <p>{formatNumber('.1%', div0(num, den))}</p>
    </div>
  );
}

function buildRow(
  metricsControl: {}[],
  metricsTest: {}[],
  timestamps: { time: Date }[],
  numeratorMetric: string,
  denominatorMetric: string,
) {
  const lastControl = metricsControl.at(-1);
  const lastTest = metricsTest.at(-1);
  const deltaArray = getDelta(
    metricsControl,
    metricsTest,
    numeratorMetric,
    denominatorMetric,
  );
  const lastDelta = deltaArray.at(-1);
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

  return {
    metric: `${numeratorMetric} / ${denominatorMetric}`,
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
    spark: renderSparklineCell(deltaArray, 'abc', timestamps),
  };
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
  } = props;
  const rootElem = createRef<HTMLDivElement>();

  const columns = useMemo(
    () => [
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
        cellProps: { style: { width: '50%' } },
      },
    ],
    [],
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
      ),
    );
  }

  return (
    <TimeTableStyles
      ref={rootElem}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <TableView
        className="table-no-hover"
        columns={columns}
        data={rows}
        withPagination={false}
      />
    </TimeTableStyles>
  );
}
