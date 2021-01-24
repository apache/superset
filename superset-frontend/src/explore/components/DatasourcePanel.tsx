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
import { styled, t, QueryFormData } from '@superset-ui/core';
import { Collapse } from 'src/common/components';
import {
  ColumnOption,
  MetricOption,
  ControlType,
} from '@superset-ui/chart-controls';
import { debounce } from 'lodash';
import { matchSorter, rankings } from 'match-sorter';
import { ExploreActions } from '../actions/exploreActions';
import Control from './Control';

interface DatasourceControl {
  validationErrors: Array<any>;
  mapStateToProps: QueryFormData;
  type: ControlType;
  label: string;
  datasource?: DatasourceControl;
}

type Columns = {
  column_name: string;
  description: string | undefined;
  expression: string | undefined;
  filterable: boolean;
  groupby: string | undefined;
  id: number;
  is_dttm: boolean;
  python_date_format: string;
  type: string;
  verbose_name: string;
};

type Metrics = {
  certification_details: string | undefined;
  certified_by: string | undefined;
  d3format: string | undefined;
  description: string | undefined;
  expression: string;
  id: number;
  is_certified: boolean;
  metric_name: string;
  verbose_name: string;
  warning_text: string;
};

interface Props {
  datasource: {
    columns: Array<Columns>;
    metrics: Array<Metrics>;
  };
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
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }
  .ant-collapse > .ant-collapse-item > .ant-collapse-header {
    padding-left: ${({ theme }) => theme.gridUnit * 2}px;
    padding-bottom: 0px;
  }
  .ant-collapse-item {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    .anticon.anticon-right.ant-collapse-arrow > svg {
      transform: rotate(90deg) !important;
      margin-right: ${({ theme }) => theme.gridUnit * -2}px;
    }
  }
  .ant-collapse-item.ant-collapse-item-active {
    .anticon.anticon-right.ant-collapse-arrow > svg {
      transform: rotate(-90deg) !important;
    }
    .ant-collapse-header {
      border: 0;
    }
  }
  .header {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    margin-left: ${({ theme }) => theme.gridUnit * -2}px;
  }
  .ant-collapse-borderless
    > .ant-collapse-item
    > .ant-collapse-content
    > .ant-collapse-content-box {
    padding: 0px;
  }
  .field-selections {
    padding: ${({ theme }) =>
      `${2 * theme.gridUnit}px ${2 * theme.gridUnit}px ${
        4 * theme.gridUnit
      }px`};
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

  const search = debounce((value: string) => {
    if (value === '') {
      setList({ columns, metrics });
      return;
    }
    setList({
      columns: matchSorter(columns, value, {
        keys: [
          'verbose_name',
          'column_name',
          {
            key: 'description',
            threshold: rankings.CONTAINS,
          },
          {
            key: 'expression',
            threshold: rankings.CONTAINS,
          },
        ],
        keepDiacritics: true,
      }),
      metrics: matchSorter(metrics, value, {
        keys: [
          'verbose_name',
          'metric_name',
          {
            key: 'description',
            threshold: rankings.CONTAINS,
          },
          {
            key: 'expression',
            threshold: rankings.CONTAINS,
          },
        ],
        keepDiacritics: true,
        baseSort: (a, b) =>
          Number(b.item.is_certified) - Number(a.item.is_certified) ||
          String(a.rankedValue).localeCompare(b.rankedValue),
      }),
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

  return (
    <DatasourceContainer>
      <Control
        {...datasourceControl}
        name="datasource"
        validationErrors={datasourceControl.validationErrors}
        actions={actions}
        formData={datasourceControl.mapStateToProps}
      />
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
          bordered={false}
          defaultActiveKey={['metrics', 'column']}
          expandIconPosition="right"
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
    </DatasourceContainer>
  );
}
