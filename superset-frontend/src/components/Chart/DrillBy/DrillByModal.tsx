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
import {
  BaseFormData,
  BinaryQueryObjectFilterClause,
  Column,
  QueryData,
  css,
  ensureIsArray,
  isDefined,
  t,
  useTheme,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Modal from 'src/components/Modal';
import Loading from 'src/components/Loading';
import Button from 'src/components/Button';
import { RootState } from 'src/dashboard/types';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { noOp } from 'src/utils/common';
import { simpleFilterToAdhoc } from 'src/utils/simpleFilterToAdhoc';
import { useDatasetMetadataBar } from 'src/features/datasets/metadataBar/useDatasetMetadataBar';
import { SingleQueryResultPane } from 'src/explore/components/DataTablesPane/components/SingleQueryResultPane';
import { Dataset, DrillByType } from '../types';
import DrillByChart from './DrillByChart';
import { ContextMenuItem } from '../ChartContextMenu/ChartContextMenu';
import { useContextMenu } from '../ChartContextMenu/useContextMenu';
import { getChartDataRequest } from '../chartAction';
import { useDisplayModeToggle } from './useDisplayModeToggle';
import {
  DrillByBreadcrumb,
  useDrillByBreadcrumbs,
} from './useDrillByBreadcrumbs';

const DATA_SIZE = 15;
interface ModalFooterProps {
  closeModal?: () => void;
  formData: BaseFormData;
}

const ModalFooter = ({ formData, closeModal }: ModalFooterProps) => {
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

export interface DrillByModalProps {
  column?: Column;
  dataset: Dataset;
  filters?: BinaryQueryObjectFilterClause[];
  formData: BaseFormData & { [key: string]: any };
  groupbyFieldName?: string;
  adhocFilterFieldName?: string;
  onHideModal: () => void;
}

export default function DrillByModal({
  column,
  dataset,
  filters,
  formData,
  groupbyFieldName = 'groupby',
  adhocFilterFieldName = 'adhoc_filters',
  onHideModal,
}: DrillByModalProps) {
  const theme = useTheme();

  const initialGroupbyColumns = useMemo(
    () =>
      ensureIsArray(formData[groupbyFieldName])
        .map(colName =>
          dataset.columns?.find(col => col.column_name === colName),
        )
        .filter(isDefined),
    [dataset.columns, formData, groupbyFieldName],
  );

  const { displayModeToggle, drillByDisplayMode } = useDisplayModeToggle();
  const [chartDataResult, setChartDataResult] = useState<QueryData[]>();
  const [datasourceId] = useMemo(
    () => formData.datasource.split('__'),
    [formData.datasource],
  );

  const [currentColumn, setCurrentColumn] = useState<Column | undefined>(
    column,
  );
  const [currentFormData, setCurrentFormData] = useState(formData);
  const [currentFilters, setCurrentFilters] = useState(filters || []);
  const [usedGroupbyColumns, setUsedGroupbyColumns] = useState<Column[]>(
    [...initialGroupbyColumns, column].filter(isDefined),
  );
  const [breadcrumbsData, setBreadcrumbsData] = useState<DrillByBreadcrumb[]>([
    { groupby: initialGroupbyColumns, filters },
    { groupby: column || [] },
  ]);

  const getNewGroupby = useCallback(
    (groupbyCol: Column) =>
      Array.isArray(formData[groupbyFieldName])
        ? [groupbyCol.column_name]
        : groupbyCol.column_name,
    [formData, groupbyFieldName],
  );

  const onBreadcrumbClick = useCallback(
    (breadcrumb: DrillByBreadcrumb, index: number) => {
      const newGroupbyCol =
        index === 0 ? undefined : (breadcrumb.groupby as Column);
      setCurrentColumn(newGroupbyCol);
      setCurrentFilters(filters => filters.slice(0, index));
      setBreadcrumbsData(prevBreadcrumbs => {
        const newBreadcrumbs = prevBreadcrumbs.slice(0, index + 1);
        delete newBreadcrumbs[newBreadcrumbs.length - 1].filters;
        return newBreadcrumbs;
      });
      setUsedGroupbyColumns(prevUsedGroupbyColumns =>
        prevUsedGroupbyColumns.slice(0, index),
      );
      setCurrentFormData(prevFormData => ({
        ...prevFormData,
        [groupbyFieldName]: newGroupbyCol
          ? getNewGroupby(newGroupbyCol)
          : formData[groupbyFieldName],
        [adhocFilterFieldName]: [
          ...formData[adhocFilterFieldName],
          ...prevFormData[adhocFilterFieldName].slice(
            formData[adhocFilterFieldName].length,
            formData[adhocFilterFieldName].length + index,
          ),
        ],
      }));
    },
    [adhocFilterFieldName, formData, getNewGroupby, groupbyFieldName],
  );

  const breadcrumbs = useDrillByBreadcrumbs(breadcrumbsData, onBreadcrumbClick);

  const drilledFormData = useMemo(() => {
    let updatedFormData = { ...formData };
    if (currentColumn) {
      updatedFormData[groupbyFieldName] = getNewGroupby(currentColumn);
    }

    const adhocFilters = currentFilters.map(filter =>
      simpleFilterToAdhoc(filter),
    );
    updatedFormData = {
      ...updatedFormData,
      [adhocFilterFieldName]: [
        ...ensureIsArray(formData[adhocFilterFieldName]),
        ...adhocFilters,
      ],
    };
    updatedFormData.slice_id = 0;
    delete updatedFormData.slice_name;
    delete updatedFormData.dashboards;
    return updatedFormData;
  }, [
    formData,
    currentColumn,
    currentFilters,
    groupbyFieldName,
    getNewGroupby,
    adhocFilterFieldName,
  ]);

  useEffect(() => {
    setUsedGroupbyColumns(usedCols =>
      !currentColumn ||
      usedCols.some(
        usedCol => usedCol.column_name === currentColumn.column_name,
      )
        ? usedCols
        : [...usedCols, currentColumn],
    );
  }, [currentColumn]);

  const onSelection = useCallback(
    (newColumn: Column, filters: BinaryQueryObjectFilterClause[]) => {
      setCurrentColumn(newColumn);
      setCurrentFormData(drilledFormData);
      setCurrentFilters(prevFilters => [...prevFilters, ...filters]);
      setBreadcrumbsData(prevBreadcrumbs => {
        const newBreadcrumbs = [...prevBreadcrumbs, { groupby: newColumn }];
        newBreadcrumbs[newBreadcrumbs.length - 2].filters = filters;
        return newBreadcrumbs;
      });
    },
    [drilledFormData],
  );

  const additionalConfig = useMemo(
    () => ({
      drillBy: { excludedColumns: usedGroupbyColumns, openNewModal: false },
    }),
    [usedGroupbyColumns],
  );

  const { contextMenu, inContextMenu, onContextMenu } = useContextMenu(
    0,
    currentFormData,
    onSelection,
    ContextMenuItem.DrillBy,
    additionalConfig,
  );

  const chartName = useSelector<RootState, string | undefined>(state => {
    const chartLayoutItem = Object.values(state.dashboardLayout.present).find(
      layoutItem => layoutItem.meta?.chartId === formData.slice_id,
    );
    return (
      chartLayoutItem?.meta.sliceNameOverride || chartLayoutItem?.meta.sliceName
    );
  });

  useEffect(() => {
    if (drilledFormData) {
      setChartDataResult(undefined);
      getChartDataRequest({
        formData: drilledFormData,
      }).then(({ json }) => {
        setChartDataResult(json.result);
      });
    }
  }, [drilledFormData]);
  const { metadataBar } = useDatasetMetadataBar({ dataset });

  return (
    <Modal
      css={css`
        .ant-modal-footer {
          border-top: none;
        }
      `}
      show
      onHide={onHideModal ?? (() => null)}
      title={t('Drill by: %s', chartName)}
      footer={<ModalFooter formData={drilledFormData} />}
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
        {breadcrumbs}
        {displayModeToggle}
        {!chartDataResult && <Loading />}
        {drillByDisplayMode === DrillByType.Chart && chartDataResult && (
          <DrillByChart
            formData={drilledFormData}
            result={chartDataResult}
            onContextMenu={onContextMenu}
            inContextMenu={inContextMenu}
          />
        )}
        {drillByDisplayMode === DrillByType.Table && chartDataResult && (
          <div
            css={css`
              .pagination-container {
                bottom: ${-theme.gridUnit * 4}px;
              }
            `}
          >
            <SingleQueryResultPane
              colnames={chartDataResult[0].colnames}
              coltypes={chartDataResult[0].coltypes}
              data={chartDataResult[0].data}
              dataSize={DATA_SIZE}
              datasourceId={datasourceId}
              isVisible
            />
          </div>
        )}
        {contextMenu}
      </div>
    </Modal>
  );
}
