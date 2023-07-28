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
import React, {useEffect} from 'react';
import cubejs from "@cubejs-client/core";
import { styled } from '@superset-ui/core';
import { CubeTableProps, CubeTableStylesProps } from './types';
import {Table} from "antd";

const Styles = styled.div<CubeTableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

export default function CubeTable(props: CubeTableProps) {
  const { height, width, filters, dataset , handlebarsDataTemplate, handlebarsEmptyTemplate, styleTemplate, dimensions} = props;
  const [data, setData] = React.useState([]);

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);
  const appliedFilters = filters.find((filter) => filter.dataset === dataset);

  const queryDimensions = dimensions.map((dimension: string) => dataset + "." + dimension);

  const cols = dimensions.map((dimension: string) => {
    return {
      title: dimension,
      dataIndex: dataset + "." + dimension,
      key: dataset + "." + dimension,
    }
  });


  useEffect(() => {
    cubejsApi
      .load({
        dimensions: queryDimensions,
      })
      .then((result) => {
        const data = result.loadResponse.results[0].data.map((row: any) => {
          return {
            ...row,
            button: 'aNonEmptyValue'
          }
        });

        setData(data);
      });
  }, []);

  useEffect(() => {
    console.log('apply context to buttons');

    // cols.push(
    //   {
    //     title: 'Button Test',
    //     key: 'button',
    //     dataIndex: 'button',
    //     render: (text: string, record: object) => {
    //       let filterValue = appliedFilters?.val;
    //       let active = false;
    //
    //       if (filterValue) {
    //         console.log(record);
    //         console.log(filterValue);
    //         //const valueIdentifier = dataset + "." + appliedFilters.col;
    //         // active = filterValue === record[valueIdentifier];
    //       }
    //
    //      if (active) {
    //        return (<button className="ant-btn-primary" onClick={()=> console.log(record)}>
    //          {"START"}
    //        </button>);
    //      } else {
    //        return <button className="ant-btn-primary" onClick={()=> console.log(record)}>
    //          {"STOP"}
    //        </button>
    //      }
    //     },
    //   },
    // );
  }, [appliedFilters?.val]);

    return (
    <Styles
      height={height}
      width={width}
    >
      <Table dataSource={data} columns={cols} />
    </Styles>
  );
}
