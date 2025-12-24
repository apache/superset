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
import { EmptyState, Flex, Space } from '@superset-ui/core/components';
import { css } from '@apache-superset/core/ui';
import { DatabaseSelector } from 'src/components';
import { ViewContribution } from 'src/SqlLab/contributions';
import ActionPanel, { type ActionPanelProps } from 'src/components/ActionPanel';

import useDatabaseSelector from './useDatabaseSelector';

export interface SqlEditorTopBarProps {
  queryEditorId: string;
  defaultPrimaryActions: React.ReactNode;
  defaultSecondaryActions: ActionPanelProps['defaultItems'];
}

const SqlEditorTopBar = ({
  queryEditorId,
  defaultPrimaryActions,
  defaultSecondaryActions,
}: SqlEditorTopBarProps) => {
  const dbSelectorProps = useDatabaseSelector(queryEditorId);

  return (
    <Flex justify="space-between" gap="small">
      <DatabaseSelector
        {...dbSelectorProps}
        emptyState={<EmptyState />}
        sqlLabMode
        horizontalMode
      />
      <Flex flex={1} gap="small" justify="end">
        <ActionPanel
          viewId={ViewContribution.Editor}
          secondary
          defaultItems={defaultSecondaryActions}
        />
        <Flex
          gap="small"
          css={css`
            flex-direction: row-reverse;
          `}
        >
          <ActionPanel viewId={ViewContribution.Editor} primary compactMode>
            {defaultPrimaryActions}
          </ActionPanel>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default SqlEditorTopBar;
