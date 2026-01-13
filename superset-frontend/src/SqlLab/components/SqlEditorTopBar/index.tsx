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
import { Divider, Flex } from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/ui';
import { ViewContribution } from 'src/SqlLab/contributions';
import MenuListExtension, {
  type MenuListExtensionProps,
} from 'src/components/MenuListExtension';

const StyledFlex = styled(Flex)`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;

  & .ant-divider {
    margin: ${({ theme }) => theme.sizeUnit * 2}px 0;
    height: ${({ theme }) => theme.sizeUnit * 6}px;
  }
`;
export interface SqlEditorTopBarProps {
  queryEditorId: string;
  defaultPrimaryActions: React.ReactNode;
  defaultSecondaryActions: MenuListExtensionProps['defaultItems'];
}

const SqlEditorTopBar = ({
  defaultPrimaryActions,
  defaultSecondaryActions,
}: SqlEditorTopBarProps) => (
  <StyledFlex justify="space-between" gap="small" id="js-sql-toolbar">
    <Flex flex={1} gap="small" align="center">
      <Flex gap="small" align="center">
        <MenuListExtension viewId={ViewContribution.Editor} primary compactMode>
          {defaultPrimaryActions}
        </MenuListExtension>
      </Flex>
      <Divider type="vertical" />
      <MenuListExtension
        viewId={ViewContribution.Editor}
        secondary
        defaultItems={defaultSecondaryActions}
      />
      <Divider type="vertical" />
    </Flex>
  </StyledFlex>
);

export default SqlEditorTopBar;
