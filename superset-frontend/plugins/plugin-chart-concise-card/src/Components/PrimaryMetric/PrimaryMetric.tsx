import { styled } from '@superset-ui/core';
import React from 'react';
import { PrimaryMetricProps } from '../../types';

const Metric = styled.div`
  font-size: 40px;
  font-weight: 600;
  position: relative;
  bottom: 30px;
  left: 20px;
`;

export default function PrimaryMetric(props: PrimaryMetricProps) {
  const { primaryMetric } = props;

  const value = primaryMetric.value.toFixed(1);

  return (
    <div>
      <Metric>{value}</Metric>
    </div>
  );
}
