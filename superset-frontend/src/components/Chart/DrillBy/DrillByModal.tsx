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

import React from 'react';
import {
  BinaryQueryObjectFilterClause,
  Column,
  css,
  t,
  useTheme,
} from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import DrillByChart from './DrillByChart';

interface ModalFooterProps {
  exploreChart: () => void;
  closeModal?: () => void;
}

const ModalFooter = ({ exploreChart, closeModal }: ModalFooterProps) => (
  <>
    <Button buttonStyle="secondary" buttonSize="small" onClick={exploreChart}>
      {t('Edit chart')}
    </Button>
    <Button
      buttonStyle="primary"
      buttonSize="small"
      onClick={closeModal}
      data-test="close-drill-by-modal"
    >
      {t('Close')}
    </Button>
  </>
);

interface DrillByModalProps {
  column?: Column;
  filters?: BinaryQueryObjectFilterClause[];
  formData: { [key: string]: any; viz_type: string };
  groupbyFieldName?: string;
  onHideModal: () => void;
  showModal: boolean;
}

export default function DrillByModal({
  column,
  filters,
  formData,
  groupbyFieldName,
  onHideModal,
  showModal,
}: DrillByModalProps) {
  const theme = useTheme();
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const chartLayoutItem = Object.values(dashboardLayout).find(
    layoutItem => layoutItem.meta?.chartId === formData.slice_id,
  );
  const chartName =
    chartLayoutItem?.meta.sliceNameOverride || chartLayoutItem?.meta.sliceName;
  const exploreChart = () => {};

  return (
    <Modal
      css={css`
        .ant-modal-footer {
          border-top: none;
        }
      `}
      show={showModal}
      onHide={onHideModal ?? (() => null)}
      title={t('Drill by: %s', chartName)}
      footer={<ModalFooter exploreChart={exploreChart} />}
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
      maskClosable={false}
    >
      <DrillByChart
        column={column}
        filters={filters}
        formData={formData}
        groupbyFieldName={groupbyFieldName}
      />
    </Modal>
  );
}
