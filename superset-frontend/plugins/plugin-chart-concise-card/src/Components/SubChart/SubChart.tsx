import { styled } from '@superset-ui/core';
import React from 'react';
import FilterFieldsContainer from '../FilterFieldsContainer/FilterFieldsContainer';
import { Metric, SubChartProps } from '../../types';
// @ts-ignore
import spinner from '../../images/loading.gif';

import RunQueryButton from '../RunQueryButton/RunQueryButton';
import Result from '../Result/Result';
import NoResult from '../NoResult/NoResult';

const Styles = styled.div<{ borderTopColor: string }>`
  width: 350px;
  height: 350px;
  border: 1px solid lightgrey;
  border-top: ${props => props.borderTopColor} solid 5px;
  border-radius: 25px;
  position: relative;
`;

const SpinnerComponent = styled.img`
  position: relative;
  bottom: 170px;
  left: 140px;
  width: 62px;
  height: 33px;
  z-index: 999;
`;

export default function SubChart(props: SubChartProps) {
  const {
    borderTopColor,
    data,
    formData,
    filterFieldsData,
    setShouldRunQuery,
    enableRunButton,
    isQueryRunning,
  } = props;

  const { metrics } = formData;

  const extractedMetrics: Metric[] = [];

  metrics.forEach(m => {
    extractedMetrics.push({
      key: m.label,
      value: data[m.label],
    } as Metric);
  });

  const primaryMetric = extractedMetrics[0];

  const secondaryMetrics = extractedMetrics.slice(1);

  return (
    <Styles borderTopColor={borderTopColor}>
      <FilterFieldsContainer filterFieldsData={filterFieldsData} />
      <RunQueryButton setShouldRunQuery={setShouldRunQuery} enableRunButton={enableRunButton} />

      {primaryMetric.value ? (
        <Result primaryMetric={primaryMetric} secondaryMetrics={secondaryMetrics} />
      ) : (
        <NoResult />
      )}
      {isQueryRunning && <SpinnerComponent src={spinner} />}
    </Styles>
  );
}
