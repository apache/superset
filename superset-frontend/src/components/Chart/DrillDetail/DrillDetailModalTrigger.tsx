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

import React, { ReactNode, useCallback, useContext, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  QueryObjectFilterClause,
  css,
  SqlaFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import ModalTrigger from 'src/components/ModalTrigger';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { Slice } from 'src/types/Chart';
import DrillDetailPane from './DrillDetailPane';

interface ModalFooterProps {
  exploreChart: () => void;
  closeModal?: () => void;
}

const ModalFooter = ({ exploreChart, closeModal }: ModalFooterProps) => (
  <>
    <Button buttonStyle="secondary" buttonSize="small" onClick={exploreChart}>
      {t('Edit chart')}
    </Button>
    <Button buttonStyle="primary" buttonSize="small" onClick={closeModal}>
      {t('Close')}
    </Button>
  </>
);

interface DrillDetailModalTriggerProps {
  children: ReactNode;
  chartId: number;
  formData: SqlaFormData;
  filters?: QueryObjectFilterClause[];
}

export default function DrillDetailModalTrigger({
  children,
  chartId,
  formData,
  filters,
}: DrillDetailModalTriggerProps) {
  const theme = useTheme();
  const history = useHistory();
  const dashboardPageId = useContext(DashboardPageIdContext);
  const { slice_name: chartName } = useSelector(
    (state: { sliceEntities: { slices: Record<number, Slice> } }) =>
      state.sliceEntities.slices[chartId],
  );

  const exploreUrl = useMemo(
    () => `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${chartId}`,
    [chartId, dashboardPageId],
  );

  const exploreChart = useCallback(() => {
    history.push(exploreUrl);
  }, [exploreUrl, history]);

  return (
    <ModalTrigger
      css={css`
        .ant-modal-body {
          display: flex;
          flex-direction: column;
        }
      `}
      modalTitle={t('Drill to detail: %s', chartName)}
      triggerNode={children}
      modalFooter={<ModalFooter exploreChart={exploreChart} />}
      modalBody={
        <DrillDetailPane formData={formData} initialFilters={filters} />
      }
      responsive
      resizable
      resizableConfig={{
        minHeight: theme.gridUnit * 128,
        minWidth: theme.gridUnit * 128,
        defaultSize: {
          width: 'auto',
          height: '75vh',
        },
      }}
      draggable
    />
  );
}
