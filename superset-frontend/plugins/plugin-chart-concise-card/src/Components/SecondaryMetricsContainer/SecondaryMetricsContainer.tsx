import { styled } from '@superset-ui/core';
import React from 'react';
import SecondaryMetric from '../SecondaryMetric/SecondaryMetric';
import { SecondaryMetricsContainerProps } from '../../types';

export default function SecondaryMetricContainer(props: SecondaryMetricsContainerProps) {
  const MetricContainer = styled.div`
    margin-top: 40px;
    line-height: 22px;
    position: relative;
    bottom: 40px;
  `;

  const { secondaryMetrics } = props;

  const metricComponents = secondaryMetrics.map(m => {
    return <SecondaryMetric metric={m} />;
  });

  return <MetricContainer>{metricComponents}</MetricContainer>;
}
