import { styled } from '@superset-ui/core';
import React from 'react';
import { Metric } from '../../types';

const Container = styled.div`
  width: 320px;
  display: inline-block;
  line-height: 0.9;
`;

const Name = styled.span`
  font-weight: 600;
  font-size: 15px;
  position: relative;
  left: 20px;
  color: #6e6e6e;
`;

const Value = styled.span`
  font-weight: 650;
  font-size: 18px;
  text-align: right;
  align-content: end;
  position: relative;
  float: right;
`;

export default function SecondaryMetric(props: { metric: Metric }) {
  const { metric } = props;

  const value = metric.value % 1 === 0 ? metric.value : metric.value.toPrecision(3);

  return (
    <Container key={metric.key}>
      <Name>{metric.key}</Name>
      <Value>{value}</Value>
    </Container>
  );
}
