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
import { EmptyState, Flex } from '@superset-ui/core/components';
import { css, styled } from '@apache-superset/core/ui';
import { MenuItemType } from '@superset-ui/core/components/Menu';
import { ViewContribution } from 'src/SqlLab/contributions';
import PanelToolbar from 'src/components/PanelToolbar';
import { DatabaseSelector } from 'src/components';
import useDatabaseSelector from './useDatabaseSelector';

const StyledFlex = styled(Flex)`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit}px 0;
`;

export interface SqlEditorTopBarProps {
  queryEditorId: string;
  defaultPrimaryActions: React.ReactNode;
  defaultSecondaryActions: MenuItemType[];
}

const SqlEditorTopBar = ({
  queryEditorId,
  defaultPrimaryActions,
  defaultSecondaryActions,
}: SqlEditorTopBarProps) => {
  const dbSelectorProps = useDatabaseSelector(queryEditorId);
  return (
    <StyledFlex justify="space-between" gap="small" id="js-sql-toolbar">
      <Flex gap="small" align="center">
        <Flex gap="small" align="center">
          <PanelToolbar
            viewId={ViewContribution.Editor}
            defaultPrimaryActions={defaultPrimaryActions}
            defaultSecondaryActions={defaultSecondaryActions}
          />
        </Flex>
      </Flex>
      <Flex
        flex={1}
        justify="end"
        css={css`
          min-width: 0;
          overflow: hidden;
        `}
      >
        <DatabaseSelector
          {...dbSelectorProps}
          emptyState={<EmptyState />}
          sqlLabMode
        />
      </Flex>
    </StyledFlex>
  );
};

export default SqlEditorTopBar;
