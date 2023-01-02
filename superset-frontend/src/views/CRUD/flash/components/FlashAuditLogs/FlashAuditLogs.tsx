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
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ListView from 'src/components/ListView';
import { Tooltip } from 'src/components/Tooltip';
import SubMenu from 'src/views/components/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useFlashListViewResource } from 'src/views/CRUD/hooks';
import ReactJson from 'react-json-view';
import { FlashAuditLogs } from '../../types';

const PAGE_SIZE = 25;

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
        Cell: ({
          row: {
            original: { description = '' },
          },
        }: any) => (
          <Tooltip title={description} placement="topLeft">
            <span>{description}</span>
          </Tooltip>
        ),
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
        }: any) => moment(new Date(timeStamp)).format('YYYY-MM-DD hh:mm:ss a'),
        Header: t('Time Stamp'),
        accessor: 'timestamp',
      },

      {
        accessor: 'newValue',
        Header: t('New Value'),
        size: 'xl',
        Cell: ({
          row: {
            original: { newValue = '' },
          },
        }: any) => (
          <ReactJson
            name="New Value"
            enableClipboard
            theme="rjv-default"
            src={JSON.parse(newValue)}
          />
        ),
      },
      {
        accessor: 'oldValue',
        Header: t('Old Value'),
        size: 'xl',
        Cell: ({
          row: {
            original: { oldValue = '' },
          },
        }: any) => (
          <ReactJson
            name="Old Value"
            enableClipboard
            theme="rjv-default"
            src={JSON.parse(oldValue)}
          />
        ),
      },
    ],
    [],
  );
  const path = `/flash/list/`;
  const title =
    logs && logs.length > 0 ? JSON.parse(logs[0].newValue).tableName : '';
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
      <ListView<FlashAuditLogs>
        className="audit-log-list-view"
        columns={columns}
        count={logCount}
        data={logs}
        fetchData={fetchData}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(FlashAuditLog);
