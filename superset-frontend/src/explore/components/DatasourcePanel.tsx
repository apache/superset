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
  .form-control.input-sm {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
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
    padding: ${({ theme }) => 2 * theme.gridUnit}px;
    overflow: auto;
  }
  .field-length {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
  .form-control.input-sm {
    margin-bottom: 0;
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

const DataSourcePanel = ({
  datasource,
  controls: { datasource: datasourceControl },
  actions,
}: Props) => {
  const { columns, metrics } = datasource;
  const [lists, setList] = useState({
    columns,
    metrics,
  });
  const search = ({ target: { value } }: { target: { value: string } }) => {
    if (value === '') {
      setList({ columns, metrics });
      return;
    }
    const filteredColumns = lists.columns.filter(
      column => column.column_name.indexOf(value) !== -1,
    );
    const filteredMetrics = lists.metrics.filter(
      metric => metric.metric_name.indexOf(value) !== -1,
    );
    setList({ columns: filteredColumns, metrics: filteredMetrics });
  };
  useEffect(() => {
    setList({
      columns,
      metrics,
    });
  }, [datasource]);

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
      <div className="field-selections">
        <input
          type="text"
          onChange={search}
          className="form-control input-sm"
          placeholder={t('Search Metrics & Columns')}
        />
        <Collapse
          accordion
          bordered={false}
          defaultActiveKey={['column', 'metrics']}
          expandIconPosition="right"
        >
          <Collapse.Panel
            header={<span className="header">{t('Columns')}</span>}
            key="column"
          >
            <div className="field-length">
              {t(`Showing %s of %s`, columnSlice.length, columns.length)}
            </div>
            {columnSlice.map(col => (
              <div key={col.column_name} className="column">
                <ColumnOption column={col} showType />
              </div>
            ))}
          </Collapse.Panel>
        </Collapse>
        <Collapse accordion bordered={false} expandIconPosition="right">
          <Collapse.Panel
            header={<span className="header">{t('Metrics')}</span>}
            key="metrics"
          >
            <div className="field-length">
              {t(`Showing %s of %s`, metricSlice.length, metrics.length)}
            </div>
            {metricSlice.map(m => (
              <div key={m.metric_name} className="column">
                <MetricOption metric={m} showType />
              </div>
            ))}
          </Collapse.Panel>
        </Collapse>
      </div>
    </DatasourceContainer>
  );
};

export default DataSourcePanel;
