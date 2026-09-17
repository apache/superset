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
import { css, NativeFilterScope, styled, useTheme } from '@superset-ui/core';
import { ChartConfiguration } from 'src/dashboard/types';
import { ScopingTreePanel } from './ScopingTreePanel';
import { ChartsScopingListPanel } from './ChartsScopingListPanel';

export interface ScopingModalContentProps {
  chartId: number | undefined;
  currentScope: NativeFilterScope;
  onScopeUpdate: ({ scope }: { scope: NativeFilterScope }) => void;
  onSelectChange: (chartId: number) => void;
  chartConfigs: ChartConfiguration;
  setCurrentChartId: (chartId: number | undefined) => void;
  removeCustomScope: (chartId: number) => void;
  addNewCustomScope: () => void;
}

const ModalContentContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    height: 100%;
    & > div {
      padding: ${theme.gridUnit * 4}px;
    }
  `}
`;

export const ScopingModalContent = ({
  chartId,
  currentScope,
  onScopeUpdate,
  onSelectChange,
  chartConfigs,
  setCurrentChartId,
  removeCustomScope,
  addNewCustomScope,
}: ScopingModalContentProps) => {
  const theme = useTheme();
  return (
    <ModalContentContainer>
      <div
        css={css`
          width: 35%;
          border-right: 1px solid ${theme.colors.grayscale.light2};
        `}
        data-test="scoping-list-panel"
      >
        <ChartsScopingListPanel
          setCurrentChartId={setCurrentChartId}
          activeChartId={chartId}
          chartConfigs={chartConfigs}
          removeCustomScope={removeCustomScope}
          addNewCustomScope={addNewCustomScope}
        />
      </div>
      <ScopingTreePanel
        chartId={chartId}
        currentScope={currentScope}
        onScopeUpdate={onScopeUpdate}
        onSelectChange={onSelectChange}
        chartConfigs={chartConfigs}
      />
    </ModalContentContainer>
  );
};
