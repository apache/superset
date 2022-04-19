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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ControlConfig,
  DatasourceMeta,
  ColumnMeta,
} from '@superset-ui/chart-controls';
import { debounce } from 'lodash';
import { matchSorter, rankings } from 'match-sorter';
import { css, styled, t } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { Input } from 'src/common/components';
import { FAST_DEBOUNCE } from 'src/constants';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import Control from 'src/explore/components/Control';
import DatasourcePanelDragOption from './DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';
import { StyledColumnOption, StyledMetricOption } from '../optionRenderers';

interface DatasourceControl extends ControlConfig {
  datasource?: DatasourceMeta;
}

export interface Props {
  datasource: DatasourceMeta;
  controls: {
    datasource: DatasourceControl;
  };
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
}

const Button = styled.button`
  background: none;
  border: none;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const ButtonContainer = styled.div`
  text-align: center;
  padding-top: 2px;
`;

const DatasourceContainer = styled.div`
  ${({ theme }) => css`
    background-color: ${theme.colors.grayscale.light4};
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    .ant-collapse {
      height: auto;
    }
    .field-selections {
      padding: 0 0 ${4 * theme.gridUnit}px;
      overflow: auto;
    }
    .field-length {
      margin-bottom: ${theme.gridUnit * 2}px;
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.light1};
    }
    .form-control.input-md {
      width: calc(100% - ${theme.gridUnit * 4}px);
      height: ${theme.gridUnit * 8}px;
      margin: ${theme.gridUnit * 2}px auto;
    }
    .type-label {
      font-weight: ${theme.typography.weights.light};
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.base};
    }
    .Control {
      padding-bottom: 0;
    }
  `};
`;

const LabelWrapper = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;

  & > span {
    white-space: nowrap;
  }

  .option-label {
    display: inline;
  }

  .metric-option {
    & > svg {
      min-width: ${({ theme }) => `${theme.gridUnit * 4}px`};
    }
    & > .option-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const LabelContainer = (props: {
  children: React.ReactElement;
  className: string;
}) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const isLabelTruncated = () =>
    !!(
      labelRef &&
      labelRef.current &&
      labelRef.current.scrollWidth > labelRef.current.clientWidth
    );
  const handleShowTooltip = () => {
    const shouldShowTooltip = isLabelTruncated();
    if (shouldShowTooltip !== showTooltip) {
      setShowTooltip(shouldShowTooltip);
    }
  };
  const handleResetTooltip = () => {
    setShowTooltip(true);
  };
  const extendedProps = {
    labelRef,
    showTooltip,
  };
  return (
    <LabelWrapper
      onMouseEnter={handleShowTooltip}
      onMouseLeave={handleResetTooltip}
      className={props.className}
    >
      {React.cloneElement(props.children, extendedProps)}
    </LabelWrapper>
  );
};

const enableExploreDnd = isFeatureEnabled(
  FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP,
);

export default function DataSourcePanel({
  datasource,
  controls: { datasource: datasourceControl },
  actions,
}: Props) {
  const { columns: _columns, metrics } = datasource;

  // display temporal column first
  const columns = useMemo(
    () =>
      [..._columns].sort((col1, col2) => {
        if (col1.is_dttm && !col2.is_dttm) {
          return -1;
        }
        if (col2.is_dttm && !col1.is_dttm) {
          return 1;
        }
        return 0;
      }),
    [_columns],
  );

  const [inputValue, setInputValue] = useState('');
  const [lists, setList] = useState({
    columns,
    metrics,
  });
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const DEFAULT_MAX_COLUMNS_LENGTH = 50;
  const DEFAULT_MAX_METRICS_LENGTH = 50;

  const search = useMemo(
    () =>
      debounce((value: string) => {
        if (value === '') {
          setList({ columns, metrics });
          return;
        }
        setList({
          columns: matchSorter(columns, value, {
            keys: [
              {
                key: 'verbose_name',
                threshold: rankings.CONTAINS,
              },
              {
                key: 'column_name',
                threshold: rankings.CONTAINS,
              },
              {
                key: item =>
                  [item.description, item.expression].map(
                    x => x?.replace(/[_\n\s]+/g, ' ') || '',
                  ),
                threshold: rankings.CONTAINS,
                maxRanking: rankings.CONTAINS,
              },
            ],
            keepDiacritics: true,
          }),
          metrics: matchSorter(metrics, value, {
            keys: [
              {
                key: 'verbose_name',
                threshold: rankings.CONTAINS,
              },
              {
                key: 'metric_name',
                threshold: rankings.CONTAINS,
              },
              {
                key: item =>
                  [item.description, item.expression].map(
                    x => x?.replace(/[_\n\s]+/g, ' ') || '',
                  ),
                threshold: rankings.CONTAINS,
                maxRanking: rankings.CONTAINS,
              },
            ],
            keepDiacritics: true,
            baseSort: (a, b) =>
              Number(b.item.is_certified) - Number(a.item.is_certified) ||
              String(a.rankedValue).localeCompare(b.rankedValue),
          }),
        });
      }, FAST_DEBOUNCE),
    [columns, metrics],
  );

  useEffect(() => {
    setList({
      columns,
      metrics,
    });
    setInputValue('');
  }, [columns, datasource, metrics]);

  const sortCertifiedFirst = (slice: ColumnMeta[]) =>
    slice.sort((a, b) => b.is_certified - a.is_certified);

  const metricSlice = useMemo(
    () =>
      showAllMetrics
        ? lists.metrics
        : lists.metrics.slice(0, DEFAULT_MAX_METRICS_LENGTH),
    [lists.metrics, showAllMetrics],
  );
  const columnSlice = useMemo(
    () =>
      showAllColumns
        ? sortCertifiedFirst(lists.columns)
        : sortCertifiedFirst(
            lists.columns.slice(0, DEFAULT_MAX_COLUMNS_LENGTH),
          ),
    [lists.columns, showAllColumns],
  );

  const mainBody = useMemo(
    () => (
      <>
        <Input
          allowClear
          onChange={evt => {
            setInputValue(evt.target.value);
            search(evt.target.value);
          }}
          value={inputValue}
          className="form-control input-md"
          placeholder={t('Search Metrics & Columns')}
        />
        <div className="field-selections">
          <Collapse
            bordered
            defaultActiveKey={['metrics', 'column']}
            expandIconPosition="right"
            ghost
          >
            <Collapse.Panel
              header={<span className="header">{t('Metrics')}</span>}
              key="metrics"
            >
              <div className="field-length">
                {t(
                  `Showing %s of %s`,
                  metricSlice.length,
                  lists.metrics.length,
                )}
              </div>
              {metricSlice.map(m => (
                <LabelContainer key={m.metric_name} className="column">
                  {enableExploreDnd ? (
                    <DatasourcePanelDragOption
                      value={m}
                      type={DndItemType.Metric}
                    />
                  ) : (
                    <StyledMetricOption metric={m} showType />
                  )}
                </LabelContainer>
              ))}
              {lists.metrics.length > DEFAULT_MAX_METRICS_LENGTH ? (
                <ButtonContainer>
                  <Button onClick={() => setShowAllMetrics(!showAllMetrics)}>
                    {showAllMetrics ? t('Show less...') : t('Show all...')}
                  </Button>
                </ButtonContainer>
              ) : (
                <></>
              )}
            </Collapse.Panel>
            <Collapse.Panel
              header={<span className="header">{t('Columns')}</span>}
              key="column"
            >
              <div className="field-length">
                {t(
                  `Showing %s of %s`,
                  columnSlice.length,
                  lists.columns.length,
                )}
              </div>
              {columnSlice.map(col => (
                <LabelContainer key={col.column_name} className="column">
                  {enableExploreDnd ? (
                    <DatasourcePanelDragOption
                      value={col}
                      type={DndItemType.Column}
                    />
                  ) : (
                    <StyledColumnOption column={col} showType />
                  )}
                </LabelContainer>
              ))}
              {lists.columns.length > DEFAULT_MAX_COLUMNS_LENGTH ? (
                <ButtonContainer>
                  <Button onClick={() => setShowAllColumns(!showAllColumns)}>
                    {showAllColumns ? t('Show Less...') : t('Show all...')}
                  </Button>
                </ButtonContainer>
              ) : (
                <></>
              )}
            </Collapse.Panel>
          </Collapse>
        </div>
      </>
    ),
    [
      columnSlice,
      inputValue,
      lists.columns.length,
      lists.metrics.length,
      metricSlice,
      search,
      showAllColumns,
      showAllMetrics,
    ],
  );

  return (
    <DatasourceContainer>
      <Control {...datasourceControl} name="datasource" actions={actions} />
      {datasource.id != null && mainBody}
    </DatasourceContainer>
  );
}
