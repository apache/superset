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
import Control from './Control';

interface DatasourceControl {
  validationErrors: any;
  mapStateToProps: QueryFormData;
  type: ControlType;
  label: string;
  datasource?: DatasourceControl;
}

interface Props {
  datasource: {
    columns: Array<any>;
    metrics: Array<any>;
  };
  controls: {
    datasource: DatasourceControl;
  };
  actions: any;
}

const DatasourceContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  position: relative;
  height: 100%;
  .field-selections {
    padding: 0 ${({ theme }) => 2 * theme.gridUnit}px;
  }
  .ant-collapse
    > .ant-collapse-item
    > .ant-collapse-header
    .ant-collapse-arrow {
    right: ${({ theme }) => theme.gridUnit * -50}px;
  }
  .ant-collapse > .ant-collapse-item > .ant-collapse-header {
    padding-left: 10px;
    padding-bottom: 0px;
  }
  .form-control.input-sm {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  .ant-collapse-item {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    .anticon.anticon-right.ant-collapse-arrow > svg {
      transform: rotate(90deg) !important;
    }
  }
  .ant-collapse-item.ant-collapse-item-active {
    .anticon.anticon-right.ant-collapse-arrow > svg {
      transform: rotate(-90deg) !important;
    }
  }
  .header {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    margin-left: ${({ theme }) => theme.gridUnit * -2}px;
  }
  .ant-collapse-content-box > div {
    margin-left: -14px;
  }
  .type-label {
    text-align: left;
  }
  .metric-option .option-label {
    margin-left: ${({ theme }) => theme.gridUnit * -5}px;
  }
  .field-selections {
    position: absolute;
    top: ${({ theme }) => theme.gridUnit * 15}px;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: auto;
  }
  .field-length {
    margin-top: -3px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
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
        >
          <Collapse.Panel
            header={<span className="header">{t('Columns')}</span>}
            key="column"
          >
            <div className="field-length">
              {`Showing ${columnSlice.length} of ${columns.length}`}
            </div>
            {columnSlice.map(col => (
              <div key={col.column_name} className="column">
                <ColumnOption column={col} showType />
              </div>
            ))}
          </Collapse.Panel>
        </Collapse>
        <Collapse accordion bordered={false}>
          <Collapse.Panel
            header={<span className="header">{t('Metrics')}</span>}
            key="metrics"
          >
            <div className="field-length">
              {`Showing ${metricSlice.length} of ${metrics.length}`}
            </div>
            {metricSlice.map(m => (
              <div key={m.column_name} className="column">
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
