import React from 'react';
import PrimaryMetric from '../PrimaryMetric/PrimaryMetric';
import SecondaryMetricContainer from '../SecondaryMetricsContainer/SecondaryMetricsContainer';
import { Metric } from '../../types';

export default function Result(props: {
  primaryMetric: Metric;
  secondaryMetrics: Metric[];
}) {
  const { primaryMetric, secondaryMetrics } = props;
  return (
    <div>
      <PrimaryMetric primaryMetric={primaryMetric} />
      <SecondaryMetricContainer secondaryMetrics={secondaryMetrics} />
    </div>
  );
}
