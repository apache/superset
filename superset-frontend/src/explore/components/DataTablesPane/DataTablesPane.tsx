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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback, useEffect, useMemo, useState, MouseEvent } from 'react';
import { isFeatureEnabled, FeatureFlag, styled, t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import Tabs from '@superset-ui/core/components/Tabs';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import { SamplesPane, useResultsPane } from './components';
import { DataTablesPaneProps, ResultTypes } from './types';

const StyledDiv = styled.div`
  ${() => `
    display: flex;
    height: 100%;
    flex-direction: column;
    `}
`;

const SouthPane = styled.div`
  ${({ theme }) => `
    position: relative;
    background-color: ${theme.colorBgContainer};
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
      height: 100%;
      position: relative;

      .table-condensed {
        height: 100%;
        overflow: auto;
        margin-bottom: ${theme.sizeUnit * 4}px;

        .table {
          margin-bottom: ${theme.sizeUnit * 2}px;
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
  setForceQuery,
  canDownload,
}: DataTablesPaneProps) => {
  const [activeTabKey, setActiveTabKey] = useState<string>(ResultTypes.Results);
  const [isRequest, setIsRequest] = useState<Record<ResultTypes, boolean>>({
    results: false,
    samples: false,
  });
  const [panelOpen, setPanelOpen] = useState(
    isFeatureEnabled(FeatureFlag.DatapanelClosedByDefault)
      ? false
      : getItem(LocalStorageKeys.IsDatapanelOpen, false),
  );

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.DatapanelClosedByDefault))
      setItem(LocalStorageKeys.IsDatapanelOpen, panelOpen);
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
      chartStatus &&
      chartStatus !== 'loading'
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
      <Icons.UpOutlined aria-label={t('Collapse data panel')} />
    ) : (
      <Icons.DownOutlined aria-label={t('Expand data panel')} />
    );
    return (
      <div>
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
      </div>
    );
  }, [handleCollapseChange, panelOpen]);

  const queryResultsPanes = useResultsPane({
    errorMessage,
    queryFormData,
    queryForce,
    ownState,
    isRequest: isRequest.results,
    setForceQuery,
    isVisible: ResultTypes.Results === activeTabKey,
    canDownload,
  }).map((pane, idx) => ({
    key: idx === 0 ? ResultTypes.Results : `${ResultTypes.Results} ${idx + 1}`,
    label: idx === 0 ? t('Results') : t('Results %s', idx + 1),
    children: pane,
  }));

  const tabItems = [
    ...queryResultsPanes,
    {
      key: ResultTypes.Samples,
      label: t('Samples'),
      children: (
        <StyledDiv>
          <SamplesPane
            datasource={datasource}
            queryForce={queryForce}
            isRequest={isRequest.samples}
            setForceQuery={setForceQuery}
            isVisible={ResultTypes.Samples === activeTabKey}
            canDownload={canDownload}
          />
        </StyledDiv>
      ),
    },
  ];

  return (
    <SouthPane data-test="some-purposeful-instance">
      <Tabs
        tabBarExtraContent={CollapseButton}
        activeKey={panelOpen ? activeTabKey : ''}
        onTabClick={handleTabClick}
        items={tabItems}
      />
    </SouthPane>
  );
};
