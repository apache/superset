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
import {
  QueryFormData,
  TimeseriesDataRecord,
} from '@superset-ui/core';

export interface SupersetPluginChartEchartsPtmStylesProps {
  height: number;
  width: number;
  headerFontSize: 'fontSizeSM' | 'fontSize' | 'fontSizeLG' | 'fontSizeXL' | 'fontSizeHeading1' | 'fontSizeHeading2' | 'fontSizeHeading3' | 'fontSizeHeading4' | 'fontSizeHeading5';
  boldText: boolean;
}

interface SupersetPluginChartEchartsPtmCustomizeProps {
  headerText: string;
}

type PtmZoomAxis = 'x' | 'y' | 'both';
type PtmZoomSize = 'xs' | 'sm';

interface PtmZoomControls {
  ptm_zoom_enabled: boolean;
  ptm_zoom_axis: PtmZoomAxis;
  ptm_zoom_size: PtmZoomSize;
  ptm_zoom_inset: string;
  ptm_series_type?: 'auto' | 'line' | 'bar' | 'smooth' | 'step';
  ptm_options_json?: string;
}

export type SupersetPluginChartEchartsPtmQueryFormData = QueryFormData &
  SupersetPluginChartEchartsPtmStylesProps &
  SupersetPluginChartEchartsPtmCustomizeProps &
  PtmZoomControls;

export type SupersetPluginChartEchartsPtmProps = SupersetPluginChartEchartsPtmStylesProps &
  SupersetPluginChartEchartsPtmCustomizeProps & {
    data: TimeseriesDataRecord[];
  };
