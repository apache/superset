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
import { FC, Suspense, lazy } from 'react';
import { Loading } from '@superset-ui/core/components';
import type { LineageViewProps } from './LineageView';

// The lineage view pulls in the ECharts renderer and the Sankey series, which
// only a small fraction of page loads ever open. Loading it on demand keeps
// that weight out of the SPA entrypoint for the list, explore and dashboard
// pages that merely render a "Lineage" menu item.
const LineageViewChunk = lazy(() => import('./LineageView'));

const LazyLineageView: FC<LineageViewProps> = props => (
  <Suspense fallback={<Loading />}>
    <LineageViewChunk {...props} />
  </Suspense>
);

export default LazyLineageView;
