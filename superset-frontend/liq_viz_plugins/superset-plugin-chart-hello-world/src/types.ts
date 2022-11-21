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
import { QueryFormData, supersetTheme, TimeseriesDataRecord } from '@superset-ui/core';

export interface SupersetPluginChartHelloWorldStylesProps {
  height: number;
  width: number;
  headerFontSize: keyof typeof supersetTheme.typography.sizes;
  boldText: boolean;
}

interface SupersetPluginChartHelloWorldCustomizeProps {
  headerText: string;
}

export type SupersetPluginChartHelloWorldQueryFormData = QueryFormData &
  SupersetPluginChartHelloWorldStylesProps &
  SupersetPluginChartHelloWorldCustomizeProps;

export type SupersetPluginChartHelloWorldProps = SupersetPluginChartHelloWorldStylesProps &
  SupersetPluginChartHelloWorldCustomizeProps & {
    data: TimeseriesDataRecord[];
    // add typing here for the props you pass in from transformProps.ts!
  };
