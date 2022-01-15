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
