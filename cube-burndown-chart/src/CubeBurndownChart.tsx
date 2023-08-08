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
import { CubeBurndownChartProps, CubeBurndownChartStylesProps } from './types';
import Mustache from 'mustache';
import {Line} from "react-chartjs-2";

const Styles = styled.div<CubeBurndownChartStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;


export default function CubeBurndownChart(props: CubeBurndownChartProps) {
  const { height, width, filters} = props;
  const [total, setTotal] = React.useState(0);
  const [data, setData] = React.useState({
    labels: [],
    datasets: []
  });

  const rootElem = createRef<HTMLDivElement>();

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Chart.js Line Chart',
      },
    },
  };

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

        let data = [];

        keys.forEach((key) => {
          let tempArray = tempData.map((item) => parseInt(item[key]));
          tempArray = tempArray.filter((item) => !isNaN(item));
          data[key] = tempArray;
        });

        const datasets = keys.map((key) => {
          return {
            label: key,
            data: data[key],
          }
        });

        console.log(datasets)

        const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];

        const chartData = {
          labels,
          datasets,
        };

        console.log(chartData);

        //setData(chartData);
      });

  }, [filters[0]?.val]);

  useEffect(() => {
    if (!props.totalQuery) {
      return;
    }

    let parsedTotalQuery = Mustache.render(props.totalQuery, modifiedFilters);
    const totalQuery = JSON.parse(parsedTotalQuery);

    if (totalQuery.filters[0]?.values?.length === 0 || totalQuery.filters[0]?.values[0] === "") {
      return;
    }

    cubejsApi
      .load(totalQuery)
      .then((result) => {
        const tempData = result.loadResponse.results[0].data[0];
        const tempTotal = parseInt(tempData[Object.keys(tempData)[0]]);
        console.log(tempTotal);
        setTotal(tempTotal);
      });

  }, [filters[0]?.val]);


  useEffect(() => {
    console.log(total);
    console.log(data);
  }, [total, data]);

  if (data.datasets.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <Styles
      ref={rootElem}
      height={height}
      width={width}
    >
      <Line options={chartOptions} data={data} />
    </Styles>
  );
}
