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
<<<<<<<< HEAD:superset-frontend/src/dashboard/util/getChartIdsFromComponent.ts
import { CHART_TYPE } from './componentTypes';
import type { DashboardLayout } from '../types';

export default function getChartIdsFromComponent(
  componentId: string,
  layout: DashboardLayout,
): number[] {
  const chartIds: number[] = [];
  const component = layout[componentId];

  if (!component) return chartIds;

  // If this component is a chart, add its ID
  if (component.type === CHART_TYPE && component.meta?.chartId) {
    chartIds.push(component.meta.chartId);
  }

  // Recursively check children
  if (component.children) {
    component.children.forEach((childId: string) => {
      chartIds.push(...getChartIdsFromComponent(childId, layout));
    });
  }

  return chartIds;
========
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';

const getExportGoogleSheetsUrl = (sliceId: number) =>
  `/export/chart/${sliceId}/google-sheets/`;

export default function ExportSliceToGoogleSheet({
  sliceId,
  ...rest
}: {
  sliceId: number;
}) {
  if (!isFeatureEnabled(FeatureFlag.GoogleSheetsExport)) {
    return <div id="export-to-sheets-for-chart-disabled" />;
  }

  const handleGoogleSheetsExport = () => {
    window.open(getExportGoogleSheetsUrl(sliceId), '_blank')?.focus();
  };

  return (
    <Menu.Item key="google-sheets-export" {...rest}>
      <div onClick={handleGoogleSheetsExport} role="button" tabIndex={0}>
        {t('Export to Google Sheets')}
      </div>
    </Menu.Item>
  );
>>>>>>>> origin/avenmaster:superset-frontend/src/dashboard/components/SliceHeaderControls/ExportSliceToGoogleSheet.tsx
}
