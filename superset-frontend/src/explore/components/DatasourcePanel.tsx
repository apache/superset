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
import React, { useEffect, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { Collapse } from 'src/common/components';
import {
  ColumnOption,
  MetricOption,
  ControlConfig,
  DatasourceMeta,
  Metric,
  ColumnMeta,
} from '@superset-ui/chart-controls';
import { debounce } from 'lodash';
import { matchSorter } from 'match-sorter';
import { ExploreActions } from '../actions/exploreActions';
import Control from './Control';

interface DatasourceControl extends ControlConfig {
  datasource?: DatasourceMeta;
}

interface Props {
  datasource: DatasourceMeta;
  controls: {
    datasource: DatasourceControl;
  };
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
}

const DatasourceContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  .ant-collapse {
    height: auto;
  }
  .field-selections {
    padding: ${({ theme }) => `0 0 ${4 * theme.gridUnit}px`};
    overflow: auto;
  }
  .field-length {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
  .form-control.input-md {
    width: calc(100% - ${({ theme }) => theme.gridUnit * 4}px);
    margin: ${({ theme }) => theme.gridUnit * 2}px auto;
  }
  .type-label {
    font-weight: ${({ theme }) => theme.typography.weights.light};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
  .Control {
    padding-bottom: 0;
  }
`;

const LabelContainer = styled.div`
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

export default function DataSourcePanel({
  datasource,
  controls: { datasource: datasourceControl },
  actions,
}: Props) {
  const { columns, metrics } = datasource;
  const [lists, setList] = useState({
    columns,
    metrics,
  });

  function searchByRelevance(
    datasource: Array<ColumnMeta | Metric>,
    value: string,
    isMetrics = false,
  ) {
    const properties = [
      isMetrics ? 'metric_name' : 'column_name',
      'description',
      'verbose_name',
      'expression',
    ];
    // eslint-disable-next-line @typescript-eslint/no-array-constructor
    let result = new Array();
    result = properties.map(property =>
      matchSorter(datasource, value, {
        keys: [property],
        keepDiacritics: true,
        ...(isMetrics) && { baseSort: (a, b) =>
          Number(b.item.is_certified) - Number(a.item.is_certified) ||
          String(a.rankedValue).localeCompare(b.rankedValue) },
      }),
    );
    return [...new Set(result.flat())];
  }

  const search = debounce((value: string) => {
    if (value === '') {
      setList({ columns, metrics });
      return;
    }
    setList({
      columns: searchByRelevance(columns, value),
      metrics: searchByRelevance(metrics, value, true),
    });
  }, 200);

  useEffect(() => {
    setList({
      columns,
      metrics,
    });
  }, [columns, datasource, metrics]);

  const metricSlice = lists.metrics.slice(0, 50);
  const columnSlice = lists.columns.slice(0, 50);

  const mainBody = (
    <>
      <input
        type="text"
        onChange={evt => {
          search(evt.target.value);
        }}
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
              {t(`Showing %s of %s`, metricSlice.length, lists.metrics.length)}
            </div>
            {metricSlice.map(m => (
              <LabelContainer key={m.metric_name} className="column">
                <MetricOption metric={m} showType />
              </LabelContainer>
            ))}
          </Collapse.Panel>
          <Collapse.Panel
            header={<span className="header">{t('Columns')}</span>}
            key="column"
          >
            <div className="field-length">
              {t(`Showing %s of %s`, columnSlice.length, lists.columns.length)}
            </div>
            {columnSlice.map(col => (
              <LabelContainer key={col.column_name} className="column">
                <ColumnOption column={col} showType />
              </LabelContainer>
            ))}
          </Collapse.Panel>
        </Collapse>
      </div>
    </>
  );

  return (
    <DatasourceContainer>
      <Control {...datasourceControl} name="datasource" actions={actions} />
      {datasource.id != null && mainBody}
    </DatasourceContainer>
  );
}
