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

import { css, styled, t } from '@superset-ui/core';
import moment from 'moment';
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ListView from 'src/components/ListView';
import { TooltipPlacement } from 'src/components/Tooltip';
import SubMenu from 'src/views/components/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useFlashListViewResource } from 'src/views/CRUD/hooks';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { FlashAuditLogs } from '../../types';
import ErrorStackTrace from './ErrorStackTrace';
import JsonDifference from './JsonDiff';

const PAGE_SIZE = 10;

const StyledHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;

    a,
    Link {
      margin-left: ${theme.gridUnit * 4}px;
      font-size: ${theme.typography.sizes.s};
      font-weight: ${theme.typography.weights.normal};
      text-decoration: underline;
    }
  `}
`;

interface AuditLogProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function FlashAuditLog({ addDangerToast }: AuditLogProps) {
  const { flashId }: any = useParams();
  const {
    state: { loading, resourceCount: logCount, resourceCollection: logs },
    fetchData,
  } = useFlashListViewResource<FlashAuditLogs>(
    flashId.toString(),
    t('auditlogs'),
    addDangerToast,
  );
  const [showErrorView, setShowErrorView] = useState<boolean>(false);
  const [showJsonView, setShowJsonView] = useState<boolean>(false);
  const [currentLog, setCurrentLog] = useState<FlashAuditLogs | {}>({});

  const initialSort = [{ id: 'timestamp', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'id',
        Header: t('Log Id'),
      },
      {
        accessor: 'description',
        Header: t('Description'),
        size: 'xxl',
        classNames: 'wrap-text',
      },
      {
        accessor: 'user',
        Header: t('User'),
        size: 'l',
      },
      {
        Cell: ({
          row: {
            original: { timestamp: timeStamp },
          },
        }: any) => moment(new Date(timeStamp)).format('LLLL'),
        Header: t('Time Stamp'),
        accessor: 'timestamp',
      },
      {
        accessor: 'error',
        Header: t('Error'),
        size: 'l',
        Cell: ({
          row: {
            original: { error_type = '', error_name = '' },
          },
        }: any) => (
          <span>
            <strong>{error_type} : </strong>
            {error_name}
          </span>
        ),
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleValueDifference = () => changeViewJson(original);
          const handleErrorTrace = () => changeViewErrorStack(original);
          const actions: ActionProps[] | [] = [
            {
              label: 'difference-action',
              tooltip: t('View Flash Value Difference'),
              placement: 'bottom' as TooltipPlacement,
              icon: 'Binoculars',
              onClick: handleValueDifference,
            },
            original?.description && {
              label: 'view-action',
              tooltip: t('View Error Stacktrace'),
              placement: 'bottom' as TooltipPlacement,
              icon: 'Eye',
              onClick: handleErrorTrace,
            },
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [],
  );
  const path = `/flash/list/`;
  const title =
    logs && logs.length > 0 ? JSON.parse(logs[0].newValue).tableName : '';

  const changeViewErrorStack = (log: any) => {
    setCurrentLog(log);
    setShowErrorView(true);
  };

  const changeViewJson = (log: any) => {
    setCurrentLog(log);
    setShowJsonView(true);
  };
  return (
    <>
      <SubMenu
        name={
          <StyledHeader>
            <span>{title}</span>
            <span>
              <Link to={path}>Back to all</Link>
            </span>
          </StyledHeader>
        }
      />
      {showErrorView && (
        <ErrorStackTrace
          log={currentLog as FlashAuditLogs}
          show={showErrorView}
          onHide={() => setShowErrorView(false)}
        />
      )}
      {showJsonView && (
        <JsonDifference
          log={currentLog as FlashAuditLogs}
          show={showJsonView}
          onHide={() => setShowJsonView(false)}
        />
      )}
      <ListView<FlashAuditLogs>
        className="audit-log-list-view"
        columns={columns}
        count={logCount}
        data={logs}
        fetchData={fetchData}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        columnsForWrapText={['Description', 'Error']}
      />
    </>
  );
}

export default withToasts(FlashAuditLog);
