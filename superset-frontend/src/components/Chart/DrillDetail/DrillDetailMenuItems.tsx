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

import React, { useCallback, useContext, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Behavior,
  css,
  getChartMetadataRegistry,
  SqlaFormData,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import ModalTrigger from 'src/components/ModalTrigger';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { Slice } from 'src/types/Chart';
import DrillDetailPane from './DrillDetailPane';
import { ContextMenuPayload } from '../types';

const Filter = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.primary.base};
  `}
`;

type ModalFooterProps = {
  exploreChart: () => void;
  closeModal?: () => void;
};

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

export type DrillDetailMenuItemsProps = {
  chartId: number;
  formData: SqlaFormData;
  isContextMenu?: boolean;
  contextPayload?: ContextMenuPayload;
  onSelection?: () => void;
};

export const DrillDetailMenuItems = ({
  chartId,
  formData,
  isContextMenu,
  contextPayload,
  onSelection,
  ...props
}: DrillDetailMenuItemsProps) => {
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

  const getMenuItem = useCallback(
    (key, content, filters = []) => (
      <Menu.Item
        key={`drill-to-detail-${key}`}
        onClick={onSelection}
        {...props}
      >
        <ModalTrigger
          css={css`
            .ant-modal-body {
              display: flex;
              flex-direction: column;
            }
          `}
          modalTitle={t('Drill to detail: %s', chartName)}
          triggerNode={<span>{content}</span>}
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
      </Menu.Item>
    ),
    [chartName, exploreChart, formData, onSelection, props, theme.gridUnit],
  );

  const drillToDetail = getMenuItem('none', t('Drill to detail'));
  const drillToDetailBy = (
    <Menu.SubMenu title={t('Drill to detail by')} {...props}>
      <Menu data-test="drill-to-detail-by-submenu">
        <Menu.Item disabled {...props}>
          {t(
            'Drill to detail by value is not yet supported for this chart type.',
          )}
        </Menu.Item>
      </Menu>
    </Menu.SubMenu>
  );

  return (
    <>
      {drillToDetail}
      {isContextMenu && drillToDetailBy}
    </>
  );

  // return (
  //   <>
  //     {contextPayload.filters.map((filter, i) =>
  //       getMenuItem(
  //         i,
  //         <>
  //           {`${t('Drill to detail by')} `}
  //           <Filter>{filter.formattedVal}</Filter>
  //         </>,
  //         [filter],
  //       ),
  //     )}
  //     {contextPayload.filters.length > 1 &&
  //       getMenuItem(
  //         'all',
  //         <>
  //           {`${t('Drill to detail by')} `}
  //           <Filter>{t('all')}</Filter>
  //         </>,
  //         contextPayload.filters,
  //       )}
  //   </>
  // );
};
