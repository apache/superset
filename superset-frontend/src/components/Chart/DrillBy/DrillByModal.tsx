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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  BaseFormData,
  BinaryQueryObjectFilterClause,
  Column,
  QueryData,
  css,
  ensureIsArray,
  t,
  useTheme,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { Radio } from 'src/components/Radio';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { noOp } from 'src/utils/common';
import { simpleFilterToAdhoc } from 'src/utils/simpleFilterToAdhoc';
import { useDatasetMetadataBar } from 'src/features/datasets/metadataBar/useDatasetMetadataBar';
import { SingleQueryResultPane } from 'src/explore/components/DataTablesPane/components/SingleQueryResultPane';
import { Dataset, DrillByType } from '../types';
import DrillByChart from './DrillByChart';
import { getChartDataRequest } from '../chartAction';

const DATA_SIZE = 14;
interface ModalFooterProps {
  formData: BaseFormData;
  closeModal?: () => void;
  showEditChart: boolean;
}

const ModalFooter = ({
  formData,
  closeModal,
  showEditChart,
}: ModalFooterProps) => {
  const [url, setUrl] = useState('');
  const dashboardPageId = useContext(DashboardPageIdContext);
  const [datasource_id, datasource_type] = formData.datasource.split('__');
  useEffect(() => {
    postFormData(Number(datasource_id), datasource_type, formData, 0)
      .then(key => {
        setUrl(
          `/explore/?form_data_key=${key}&dashboard_page_id=${dashboardPageId}`,
        );
      })
      .catch(e => {
        console.log(e);
      });
  }, [dashboardPageId, datasource_id, datasource_type, formData]);
  return (
    <>
      {showEditChart && (
        <Button buttonStyle="secondary" buttonSize="small" onClick={noOp}>
          <Link
            css={css`
              &:hover {
                text-decoration: none;
              }
            `}
            to={url}
          >
            {t('Edit chart')}
          </Link>
        </Button>
      )}
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
};

interface DrillByModalProps {
  column?: Column;
  filters?: BinaryQueryObjectFilterClause[];
  formData: BaseFormData & { [key: string]: any };
  groupbyFieldName?: string;
  onHideModal: () => void;
  showModal: boolean;
  dataset: Dataset;
}

export default function DrillByModal({
  column,
  filters,
  formData,
  groupbyFieldName = 'groupby',
  onHideModal,
  showModal,
  dataset,
}: DrillByModalProps) {
  const theme = useTheme();
  const [chartDataResult, setChartDataResult] = useState<QueryData[]>();
  const [showChart, setShowChart] = useState(true);
  const [datasourceId] = useMemo(
    () => formData.datasource.split('__'),
    [formData.datasource],
  );
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const chartLayoutItem = Object.values(dashboardLayout).find(
    layoutItem => layoutItem.meta?.chartId === formData.slice_id,
  );
  const chartName =
    chartLayoutItem?.meta.sliceNameOverride || chartLayoutItem?.meta.sliceName;

  const updatedFormData = useMemo(() => {
    let updatedFormData = { ...formData };
    if (column) {
      updatedFormData[groupbyFieldName] = Array.isArray(
        formData[groupbyFieldName],
      )
        ? [column.column_name]
        : column.column_name;
    }

    if (filters) {
      const adhocFilters = filters.map(filter => simpleFilterToAdhoc(filter));
      updatedFormData = {
        ...updatedFormData,
        adhoc_filters: [
          ...ensureIsArray(formData.adhoc_filters),
          ...adhocFilters,
        ],
      };
    }
    updatedFormData.slice_id = 0;
    delete updatedFormData.slice_name;
    delete updatedFormData.dashboards;
    return updatedFormData;
  }, [column, filters, formData, groupbyFieldName]);

  useEffect(() => {
    if (updatedFormData && showModal) {
      getChartDataRequest({
        formData: updatedFormData,
      }).then(({ json }) => {
        setChartDataResult(json.result);
      });
    }
  }, [updatedFormData, showModal]);
  const { metadataBar } = useDatasetMetadataBar({ dataset });

  return (
    <Modal
      css={css`
        .ant-modal-footer {
          border-top: none;
        }
      `}
      show={showModal}
      onHide={() => {
        setShowChart(true);
        setChartDataResult(undefined);
        onHideModal();
      }}
      title={t('Drill by: %s', chartName)}
      footer={
        <ModalFooter formData={updatedFormData} showEditChart={showChart} />
      }
      responsive
      resizable
      resizableConfig={{
        minHeight: theme.gridUnit * 128,
        minWidth: theme.gridUnit * 128,
        defaultSize: {
          width: 'auto',
          height: '80vh',
        },
      }}
      draggable
      destroyOnClose
      maskClosable={false}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        {metadataBar}
        <div
          css={css`
            margin-bottom: ${theme.gridUnit * 6}px;
            .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled):focus-within {
              box-shadow: none;
            }
          `}
        >
          <Radio.Group
            onChange={({ target: { value } }) => {
              setShowChart(value === DrillByType.chart);
            }}
            defaultValue={DrillByType.chart}
          >
            <Radio.Button
              value={DrillByType.chart}
              data-test="drill-by-chart-radio"
            >
              {t('Chart')}
            </Radio.Button>
            <Radio.Button
              value={DrillByType.table}
              data-test="drill-by-table-radio"
            >
              {t('Table')}
            </Radio.Button>
          </Radio.Group>
        </div>
        {showChart && chartDataResult && (
          <DrillByChart formData={updatedFormData} result={chartDataResult} />
        )}
        {!showChart && chartDataResult && (
          <SingleQueryResultPane
            data={chartDataResult[0].data}
            colnames={chartDataResult[0].colnames}
            coltypes={chartDataResult[0].coltypes}
            datasourceId={datasourceId}
            dataSize={DATA_SIZE}
            key={1}
            isVisible={!showChart}
          />
        )}
      </div>
    </Modal>
  );
}
