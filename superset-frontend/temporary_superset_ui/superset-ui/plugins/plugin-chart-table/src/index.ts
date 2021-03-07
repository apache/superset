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
import { t, ChartMetadata, ChartPlugin, BuildQueryFunction } from '@superset-ui/core';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';
import cachedBuildQuery from './buildQuery';
import { TableChartFormData, TableChartProps } from './types';

// must export something for the module to be exist in dev mode
export { default as __hack__ } from './types';
export * from './types';

const metadata = new ChartMetadata({
  canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
  description: '',
  name: t('Table'),
  thumbnail,
});

export default class TableChartPlugin extends ChartPlugin<TableChartFormData, TableChartProps> {
  constructor() {
    super({
      loadChart: () => import('./TableChart'),
      metadata,
      transformProps,
      controlPanel,
      buildQuery: cachedBuildQuery() as BuildQueryFunction<TableChartFormData>,
    });
  }
}
