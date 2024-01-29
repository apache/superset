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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  MouseEvent,
} from 'react';
import { FeatureFlag, styled, t, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Tabs from 'src/components/Tabs';
import { isFeatureEnabled } from 'src/featureFlags';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import {
  SamplesPane,
  TableControlsWrapper,
  useResultsPane,
} from './components';
import { DataTablesPaneProps, ResultTypes } from './types';

const SouthPane = styled.div`
  ${({ theme }) => `
    position: relative;
    background-color: ${theme.colors.grayscale.light5};
    z-index: 5;
    overflow: hidden;

    .ant-tabs {
      height: 100%;
    }

    .ant-tabs-content-holder {
      height: 100%;
    }

    .ant-tabs-content {
      height: 100%;
    }

    .ant-tabs-tabpane {
      display: flex;
      flex-direction: column;
      height: 100%;

      .table-condensed {
        height: 100%;
        overflow: auto;
        margin-bottom: ${theme.gridUnit * 4}px;

        .table {
          margin-bottom: ${theme.gridUnit * 2}px;
        }
      }

      .pagination-container > ul[role='navigation'] {
        margin-top: 0;
      }
    }
  `}
`;

export const DataTablesPane = ({
  queryFormData,
  datasource,
  queryForce,
  onCollapseChange,
  chartStatus,
  ownState,
  errorMessage,
  actions,
}: DataTablesPaneProps) => {
  const theme = useTheme();
  const [activeTabKey, setActiveTabKey] = useState<string>(ResultTypes.Results);
  const [isRequest, setIsRequest] = useState<Record<ResultTypes, boolean>>({
    results: false,
    samples: false,
  });
  const [panelOpen, setPanelOpen] = useState(
    isFeatureEnabled(FeatureFlag.DATAPANEL_CLOSED_BY_DEFAULT)
      ? false
      : getItem(LocalStorageKeys.is_datapanel_open, false),
  );

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.DATAPANEL_CLOSED_BY_DEFAULT))
      setItem(LocalStorageKeys.is_datapanel_open, panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) {
      setIsRequest({
        results: false,
        samples: false,
      });
    }

    if (
      panelOpen &&
      activeTabKey.startsWith(ResultTypes.Results) &&
      chartStatus === 'rendered'
    ) {
      setIsRequest({
        results: true,
        samples: false,
      });
    }

    if (panelOpen && activeTabKey === ResultTypes.Samples) {
      setIsRequest({
        results: false,
        samples: true,
      });
    }
  }, [panelOpen, activeTabKey, chartStatus]);

  const handleCollapseChange = useCallback(
    (isOpen: boolean) => {
      onCollapseChange(isOpen);
      setPanelOpen(isOpen);
    },
    [onCollapseChange],
  );

  const handleTabClick = useCallback(
    (tabKey: string, e: MouseEvent) => {
      if (!panelOpen) {
        handleCollapseChange(true);
      } else if (tabKey === activeTabKey) {
        e.preventDefault();
        handleCollapseChange(false);
      }
      setActiveTabKey(tabKey);
    },
    [activeTabKey, handleCollapseChange, panelOpen],
  );

  const CollapseButton = useMemo(() => {
    const caretIcon = panelOpen ? (
      <Icons.CaretUp
        iconColor={theme.colors.grayscale.base}
        aria-label={t('Collapse data panel')}
      />
    ) : (
      <Icons.CaretDown
        iconColor={theme.colors.grayscale.base}
        aria-label={t('Expand data panel')}
      />
    );
    return (
      <TableControlsWrapper>
        {panelOpen ? (
          <span
            role="button"
            tabIndex={0}
            onClick={() => handleCollapseChange(false)}
          >
            {caretIcon}
          </span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={() => handleCollapseChange(true)}
          >
            {caretIcon}
          </span>
        )}
      </TableControlsWrapper>
    );
  }, [handleCollapseChange, panelOpen, theme.colors.grayscale.base]);

  const queryResultsPanes = useResultsPane({
    errorMessage,
    queryFormData,
    queryForce,
    ownState,
    isRequest: isRequest.results,
    actions,
    isVisible: ResultTypes.Results === activeTabKey,
  }).map((pane, idx) => {
    if (idx === 0) {
      return (
        <Tabs.TabPane tab={t('Results')} key={ResultTypes.Results}>
          {pane}
        </Tabs.TabPane>
      );
    }
    if (idx > 0) {
      return (
        <Tabs.TabPane
          tab={t('Results %s', idx + 1)}
          key={`${ResultTypes.Results} ${idx + 1}`}
        >
          {pane}
        </Tabs.TabPane>
      );
    }
    return null;
  });

  return (
    <SouthPane data-test="some-purposeful-instance">
      <Tabs
        fullWidth={false}
        tabBarExtraContent={CollapseButton}
        activeKey={panelOpen ? activeTabKey : ''}
        onTabClick={handleTabClick}
      >
        {queryResultsPanes}
        <Tabs.TabPane tab={t('Samples')} key={ResultTypes.Samples}>
          <SamplesPane
            datasource={datasource}
            queryForce={queryForce}
            isRequest={isRequest.samples}
            actions={actions}
            isVisible={ResultTypes.Samples === activeTabKey}
          />
        </Tabs.TabPane>
      </Tabs>
    </SouthPane>
  );
};
