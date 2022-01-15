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
import SecondaryMetric from '../SecondaryMetric/SecondaryMetric';
import { SecondaryMetricsContainerProps } from '../../types';

export default function SecondaryMetricContainer(
  props: SecondaryMetricsContainerProps,
) {
  const MetricContainer = styled.div`
    margin-top: 40px;
    line-height: 22px;
    position: relative;
    bottom: 40px;
  `;

  const { secondaryMetrics } = props;

  const metricComponents = secondaryMetrics.map(m => (
    <SecondaryMetric metric={m} />
  ));

  return <MetricContainer>{metricComponents}</MetricContainer>;
}
