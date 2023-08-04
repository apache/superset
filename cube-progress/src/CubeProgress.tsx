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
import React, {useEffect, createRef} from 'react';
import cubejs from "@cubejs-client/core";
import { styled } from '@superset-ui/core';
import { CubeProgressProps, CubeProgressStylesProps } from './types';
import { Progress } from 'antd';

const Styles = styled.div<CubeProgressStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

export default function CubeProgress(props: CubeProgressProps) {
  const { height, width, filters, dataset, dimensions, progressType, totalColumn} = props;
  const [data, setData] = React.useState({});
  const [percentage, setPercentage] = React.useState(dimensions.map(() => 0));
  
  const rootElem = createRef<HTMLDivElement>();

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);
  const appliedFilters = filters.find((filter) => filter.dataset === dataset);

  const queryDimensions = [...dimensions, totalColumn].map((dimension: string) => dataset + "." + dimension);

  useEffect(() => {
    if (appliedFilters) {
      const filter = {
        "member": dataset + "." + appliedFilters.col,
        "operator": "equals",
        "values": appliedFilters.val
      };

      cubejsApi
        .load({
          dimensions: queryDimensions,
          filters: [filter],
        })
        .then((result) => {
          const tempData = result.loadResponse.results[0].data[0];
          console.log(tempData);
          setData(tempData);
        });
    }
  }, [appliedFilters?.val]);

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
