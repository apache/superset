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
import { useCallback } from 'react';
import { useAppDispatch } from 'src/SqlLab/hooks/useAppDispatch';

import { resetState } from 'src/SqlLab/actions/sqlLab';
import { Button, Icons } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { DatabaseSelectorPopover } from 'src/components/DatabaseSelector';
import { EMPTY_STATE_QE_ID } from 'src/SqlLab/hooks/useQueryEditor';

import useDatabaseSelector from '../SqlEditorTopBar/useDatabaseSelector';
import TableExploreTree from '../TableExploreTree';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
  collapsed?: boolean;
}

const LeftBarStyles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;

  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;

    .divider {
      border-bottom: 1px solid ${theme.colorSplit};
      margin: ${theme.sizeUnit * 1}px 0;
    }
  `}
`;

const StyledDivider = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colorSplit};
  margin: 0 -${({ theme }) => theme.sizeUnit * 2.5}px 0;
`;

const SqlEditorLeftBar = ({
  queryEditorId,
  collapsed = false,
}: SqlEditorLeftBarProps) => {
  const activeQEId = queryEditorId || EMPTY_STATE_QE_ID;
  const dbSelectorProps = useDatabaseSelector(activeQEId);

  const dispatch = useAppDispatch();
  const shouldShowReset = window.location.search === '?reset=1';

  const handleResetState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  const dbSelectorTrigger = (
    <DatabaseSelectorPopover
      {...dbSelectorProps}
      compactMode={collapsed}
      filterBySqlLab
    />
  );

  if (collapsed) {
    return dbSelectorTrigger;
  }

  return (
    <LeftBarStyles data-test="sql-editor-left-bar">
      {dbSelectorTrigger}
      <StyledDivider />
      <TableExploreTree queryEditorId={activeQEId} />
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleResetState}
        >
          <Icons.ClearOutlined /> {t('Reset state')}
        </Button>
      )}
    </LeftBarStyles>
  );
};

export default SqlEditorLeftBar;
