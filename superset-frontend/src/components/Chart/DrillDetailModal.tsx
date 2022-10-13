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

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import {
  BinaryQueryObjectFilterClause,
  css,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import DrillDetailPane from 'src/dashboard/components/DrillDetailPane';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { Slice } from 'src/types/Chart';
import Modal from '../Modal';
import Button from '../Button';

const DrillDetailModal: React.FC<{
  chartId: number;
  initialFilters?: BinaryQueryObjectFilterClause[];
  formData: QueryFormData;
}> = ({ chartId, initialFilters, formData }) => {
  const [showModal, setShowModal] = useState(false);
  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);
  const history = useHistory();
  const theme = useTheme();
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

  //  Trigger modal open when initial filters change
  useEffect(() => {
    if (initialFilters) {
      openModal();
    }
  }, [initialFilters, openModal]);

  return (
    <Modal
      css={css`
        .ant-modal-body {
          display: flex;
          flex-direction: column;
        }
      `}
      show={showModal}
      onHide={closeModal}
      title={t('Drill to detail: %s', chartName)}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={exploreChart}
          >
            {t('Edit chart')}
          </Button>
          <Button
            data-test="close-drilltodetail-modal"
            buttonStyle="primary"
            buttonSize="small"
            onClick={closeModal}
          >
            {t('Close')}
          </Button>
        </>
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
      destroyOnClose
    >
      <DrillDetailPane formData={formData} initialFilters={initialFilters} />
    </Modal>
  );
};

export default DrillDetailModal;
