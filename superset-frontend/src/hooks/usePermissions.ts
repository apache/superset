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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';

export const usePermissions = () => {
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );
  const canWriteExploreFormData = useSelector((state: RootState) =>
    findPermission('can_write', 'ExploreFormDataRestApi', state.user?.roles),
  );
  const canDatasourceSamples = useSelector((state: RootState) =>
    findPermission('can_samples', 'Datasource', state.user?.roles),
  );
  const canCsvLegacy = useSelector((state: RootState) =>
    findPermission('can_csv', 'Superset', state.user?.roles),
  );
  const canExportCsvSqlLab = useSelector((state: RootState) =>
    findPermission('can_export_csv', 'SQLLab', state.user?.roles),
  );
  const canExportDataGranular = useSelector((state: RootState) =>
    findPermission('can_export_data', 'Superset', state.user?.roles),
  );
  const canExportImageGranular = useSelector((state: RootState) =>
    findPermission('can_export_image', 'Superset', state.user?.roles),
  );
  const canCopyClipboardGranular = useSelector((state: RootState) =>
    findPermission('can_copy_clipboard', 'Superset', state.user?.roles),
  );
  const granularExport = isFeatureEnabled(FeatureFlag.GranularExportControls);
  const canExportData = granularExport ? canExportDataGranular : canCsvLegacy;
  const canExportImage = granularExport ? canExportImageGranular : canCsvLegacy;
  const canCopyClipboard = granularExport
    ? canCopyClipboardGranular
    : canCsvLegacy;
  const canDownload = canExportData;
  // SQL Lab uses a separate legacy permission (can_export_csv on SQLLab)
  const canExportDataSqlLab = granularExport
    ? canExportDataGranular
    : canExportCsvSqlLab;
  const canCopyClipboardSqlLab = granularExport
    ? canCopyClipboardGranular
    : canExportCsvSqlLab;
  const canDrill = useSelector((state: RootState) =>
    findPermission('can_drill', 'Dashboard', state.user?.roles),
  );
  const canGetDrillInfo = useSelector((state: RootState) =>
    findPermission('can_get_drill_info', 'Dataset', state.user?.roles),
  );
  const canDrillBy =
    (canExplore || canDrill) && canWriteExploreFormData && canGetDrillInfo;
  const canDrillToDetail =
    (canExplore || canDrill) && canDatasourceSamples && canGetDrillInfo;
  const canViewQuery = useSelector((state: RootState) =>
    findPermission('can_view_query', 'Dashboard', state.user?.roles),
  );
  const canViewTable = useSelector((state: RootState) =>
    findPermission('can_view_chart_as_table', 'Dashboard', state.user?.roles),
  );

  return {
    canExplore,
    canWriteExploreFormData,
    canDatasourceSamples,
    canDownload,
    canExportData,
    canExportDataSqlLab,
    canExportImage,
    canCopyClipboard,
    canCopyClipboardSqlLab,
    canDrill,
    canDrillBy,
    canDrillToDetail,
    canViewQuery,
    canViewTable,
  };
};
