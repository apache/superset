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
import { FC, ReactNode } from 'react';
import { t } from '@apache-superset/core';
import { ModalTrigger } from '@superset-ui/core/components';
import {
  useChartLineage,
  useDashboardLineage,
  useDatasetLineage,
} from 'src/hooks/apiResources';
import LineageView from './LineageView';

export interface LineageModalProps {
  entityType: 'dataset' | 'chart' | 'dashboard';
  entityId: string | number;
  triggerNode: ReactNode;
}

const LineageModal: FC<LineageModalProps> = ({
  entityType,
  entityId,
  triggerNode,
}) => {
  const datasetLineage = useDatasetLineage(
    entityType === 'dataset' ? entityId : '',
  );
  const chartLineage = useChartLineage(entityType === 'chart' ? entityId : '');
  const dashboardLineage = useDashboardLineage(
    entityType === 'dashboard' ? entityId : '',
  );

  const lineageResource =
    entityType === 'dataset'
      ? datasetLineage
      : entityType === 'chart'
        ? chartLineage
        : dashboardLineage;

  const title =
    entityType === 'dataset'
      ? t('Dataset Lineage')
      : entityType === 'chart'
        ? t('Chart Lineage')
        : t('Dashboard Lineage');

  return (
    <ModalTrigger
      triggerNode={triggerNode}
      modalTitle={title}
      modalBody={
        <LineageView
          lineageResource={lineageResource}
          entityType={entityType}
        />
      }
      width="850px"
      responsive
      destroyOnHidden
    />
  );
};

export default LineageModal;
