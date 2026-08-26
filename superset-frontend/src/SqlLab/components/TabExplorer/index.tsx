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
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { Button, Icons } from '@superset-ui/core/components';
import { useAppDispatch } from 'src/SqlLab/hooks/useAppDispatch';
import { resetState } from 'src/SqlLab/actions/sqlLab';
import DatabaseSelectorPopover from '../DatabaseSelectorPopover';
import TableExploreTree from '../TableExploreTree';

export interface TabExplorerProps {
  queryEditorId: string;
}

const TabExplorerStyles = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    height: 100%;
    /* Lets TableExploreTree's AutoSizer resolve a bounded height when this
       sits inside the left bar's rail/content flex layout. */
    min-height: 0;
  `}
`;

const StyledDivider = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colorSplit};
  margin: 0 -${({ theme }) => theme.sizeUnit * 2.5}px 0;
`;

const TabExplorer = ({ queryEditorId }: TabExplorerProps) => {
  const dispatch = useAppDispatch();
  const shouldShowReset = window.location.search === '?reset=1';

  const handleResetState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  return (
    <TabExplorerStyles data-test="tab-explorer">
      <DatabaseSelectorPopover queryEditorId={queryEditorId} />
      <StyledDivider />
      <TableExploreTree queryEditorId={queryEditorId} />
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleResetState}
        >
          <Icons.ClearOutlined /> {t('Reset state')}
        </Button>
      )}
    </TabExplorerStyles>
  );
};

export default TabExplorer;
