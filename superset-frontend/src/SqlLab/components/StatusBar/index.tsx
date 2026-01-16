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
import { styled } from '@apache-superset/core';
import { Flex } from '@superset-ui/core/components';
import ViewListExtension from 'src/components/ViewListExtension';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { SQL_EDITOR_STATUSBAR_HEIGHT } from 'src/SqlLab/constants';
import { ViewContribution } from 'src/SqlLab/contributions';

const Container = styled(Flex)`
  flex-direction: row-reverse;
  height: ${SQL_EDITOR_STATUSBAR_HEIGHT}px;
  background-color: ${({ theme }) => theme.colorPrimary};
  color: ${({ theme }) => theme.colorWhite};
  padding: 0 ${({ theme }) => theme.sizeUnit * 4}px;

  & .ant-tag {
    color: ${({ theme }) => theme.colorWhite};
    background-color: transparent;
    border: 0;
  }
`;

const StatusBar = () => {
  const statusBarContributions =
    ExtensionsManager.getInstance().getViewContributions(
      ViewContribution.StatusBar,
    ) || [];

  return (
    <>
      {statusBarContributions.length > 0 && (
        <Container align="center" justify="space-between">
          <ViewListExtension viewId={ViewContribution.StatusBar} />
        </Container>
      )}
    </>
  );
};

export default StatusBar;
