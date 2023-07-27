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
import { DisplayContextProps, DisplayContextStylesProps } from './types';
import {HandlebarsViewer} from "./components/Handlebars/HandlebarsViewer";

const Styles = styled.div<DisplayContextStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;
`;

export default function DisplayContext(props: DisplayContextProps) {
  const { height, width, filters, dataset , handlebarsDataTemplate, handlebarsEmptyTemplate, styleTemplate, dimensions} = props;
  const [data, setData] = React.useState({});

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);
  const appliedFilters = filters.find((filter) => filter.dataset === dataset);

  const queryDimensions = dimensions.map((dimension: string) => dataset + "." + dimension);

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
          const tempData = replaceKeyDotsToUnderscores(result.loadResponse.results[0].data[0]);
          tempData['all'] = JSON.stringify(tempData);
          setData(tempData);
        });
    }
  }, [appliedFilters?.val]);

  const objectEmpty = Object.keys(data).length === 0;

  const styleTemplateSource = styleTemplate
    ? `<style>${styleTemplate}</style>`
    : '';

  const handlebarTemplateSource = objectEmpty
    ? handlebarsEmptyTemplate
    : handlebarsDataTemplate;

  const templateSource = `${handlebarTemplateSource}\n${styleTemplateSource} `;

  return (
    <Styles
      height={height}
      width={width}
    >
      <HandlebarsViewer data={{ data }} templateSource={templateSource} />
    </Styles>
  );
}

function replaceKeyDotsToUnderscores(data: object): object {
  const newData = {};

  Object.keys(data).forEach(key => {
    const keyArray = key.split('.');
    newData[keyArray[keyArray.length - 1]] = data[key];
  });

  return newData;
}
