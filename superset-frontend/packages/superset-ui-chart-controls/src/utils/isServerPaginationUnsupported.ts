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
import { DatasourceType } from '@superset-ui/core';
import type { ControlPanelState } from '../types';

/** SemanticViewFeature value for providers that support row offsets. */
export const ROW_OFFSET = 'ROW_OFFSET';

/** Only selected-datasource metadata can describe its capabilities. */
export function hasMatchingDatasourceMetadata({
  datasource,
  form_data,
}: Pick<ControlPanelState, 'datasource' | 'form_data'>): boolean {
  return Boolean(
    datasource &&
    'uid' in datasource &&
    datasource.uid === form_data.datasource,
  );
}

/** Keep semantic pagination disabled until the view declares offset support. */
export function isServerPaginationUnsupported({
  datasource,
  form_data,
}: ControlPanelState): boolean {
  const metadataMatchesSelection = hasMatchingDatasourceMetadata({
    datasource,
    form_data,
  });
  const selectedType = form_data.datasource?.split('__')[1];
  const datasourceType =
    metadataMatchesSelection ||
    (selectedType !== DatasourceType.Table &&
      selectedType !== DatasourceType.SemanticView)
      ? datasource?.type
      : selectedType;
  const isSemanticView = datasourceType === DatasourceType.SemanticView;
  const features =
    datasource &&
    metadataMatchesSelection &&
    datasource.type === datasourceType &&
    'semantic_view_features' in datasource
      ? datasource.semantic_view_features
      : undefined;
  return Boolean(isSemanticView && !features?.includes(ROW_OFFSET));
}
