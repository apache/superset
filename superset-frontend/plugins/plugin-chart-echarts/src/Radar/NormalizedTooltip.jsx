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
/* eslint-disable import/no-extraneous-dependencies */
import ReactDOMServer from 'react-dom/server';
import { styled } from '@superset-ui/core';

const SeriesName = styled.div`
  font-weight: bold;
  margin-bottom: 5px;
`;

const MetricRow = styled.div`
  display: flex;
`;

const MetricLabel = styled.div`
  display: flex;
`;

const MetricValue = styled.div`
  font-weight: bold;
  margin-left: auto;
`;

const Dot = styled.span`
  margin-right: 5px;
  border-radius: 50%;
  width: 5px;
  height: 5px;
  align-self: center;
  background-color: ${({ color }) => color};
`;

const NormalizedTooltip = ({
  color,
  seriesName,
  metrics,
  values,
  getDenormalizedValue,
  metricsWithCustomBounds,
}) => (
  <div>
    <SeriesName>{seriesName || 'series0'}</SeriesName>
    {metrics.map((metric, index) => {
      const value = values[index];
      const originalValue = metricsWithCustomBounds.has(metric)
        ? value
        : getDenormalizedValue(seriesName, String(value));
      return (
        <MetricRow key={metric}>
          <MetricLabel>
            <Dot color={color} />
            {metric}:
          </MetricLabel>
          <MetricValue>{originalValue}</MetricValue>
        </MetricRow>
      );
    })}
  </div>
);

export const renderNormalizedTooltip = props =>
  ReactDOMServer.renderToStaticMarkup(<NormalizedTooltip {...props} />);
