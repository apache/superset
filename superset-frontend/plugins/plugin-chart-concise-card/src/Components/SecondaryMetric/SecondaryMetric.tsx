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

  const value =
    metric.value % 1 === 0 ? metric.value : metric.value.toPrecision(3);

  return (
    <Container key={metric.key}>
      <Name>{metric.key}</Name>
      <Value>{value}</Value>
    </Container>
  );
}
