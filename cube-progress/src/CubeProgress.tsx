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
import React, {createRef, useEffect} from 'react';
import cubejs from "@cubejs-client/core";
import { styled } from '@superset-ui/core';
import { CubeProgressProps, CubeProgressStylesProps } from './types';
import { Progress } from 'antd';
import Mustache from 'mustache';

const Styles = styled.div<CubeProgressStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

export default function CubeProgress(props: CubeProgressProps) {
  const { height, width, filters, dimensions, progressType, totalQuery, valueQuery} = props;
  const [total, setTotal] = React.useState(0);
  const [data, setData] = React.useState(JSON.parse(props.valueQuery).dimensions.map(() => 0));
  const [percentage, setPercentage] = React.useState(JSON.parse(props.valueQuery).dimensions.map(() => 0));

  const rootElem = createRef<HTMLDivElement>();

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'https://odtest.xip.nl/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);

  const modifiedFilters = {};

  filters.forEach((filter) => {
    modifiedFilters['filter_' + filter.col] = filter.val[0];
  });

  useEffect(() => {
    if (!props.valueQuery) {
      return;
    }

    let parsedValueQuery = Mustache.render(props.valueQuery, modifiedFilters);
    const valueQuery = JSON.parse(parsedValueQuery);

    if (valueQuery.filters[0]?.values?.length === 0 || valueQuery.filters[0]?.values[0] === "") {
      return;
    }

    cubejsApi
      .load(valueQuery)
      .then((result) => {
        const tempData = result.loadResponse.results[0].data;
        const keys = Object.keys(tempData[0]);
        const totals: Array<number> = [];

        keys.forEach((key, index) => {
          totals[index] = 0;
          tempData.reduce((a: any, b: any) => {
            const value = parseInt(b[key]);

            if (!isNaN(value)) {
              totals[index] += value;
            }

            return totals[index];
          }, 0);
        });

        setData(totals);
      });

  }, [filters[0]?.val]);

  useEffect(() => {
    if (!props.totalQuery) {
      return;
    }

    let parsedTotalQuery = Mustache.render(props.totalQuery, modifiedFilters);
    const totalQuery = JSON.parse(parsedTotalQuery);
    console.log(totalQuery);

    if (totalQuery.filters[0]?.values?.length === 0 || totalQuery.filters[0]?.values[0] === "") {
      return;
    }

    cubejsApi
      .load(totalQuery)
      .then((result) => {
        const tempData = result.loadResponse.results[0].data[0];
        const tempTotal = parseInt(tempData[Object.keys(tempData)[0]]);
        setTotal(tempTotal);
      });

  }, [filters[0]?.val]);

  useEffect(() => {
    const tempPercentage = data.map((value: number) => {
      return Math.round((value / total) * 10000) / 100;
    });

    setPercentage(tempPercentage);
  }, [total, data]);

  return (
    <Styles
      ref={rootElem}
      height={height}
      width={width}
    >
      {percentage.map((percent, index) => {
        return (
          <Progress
            key={index}
            type={progressType}
            percent={percent}
          />
        );
      })}
    </Styles>
  );
}
