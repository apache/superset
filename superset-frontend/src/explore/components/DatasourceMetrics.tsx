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

type DatasourceControl = {
  validationErrors: any;
  mapStateToProps: QueryFormData;
  type: ControlType;
  label: string;
};

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
  .ant-collapse
    > .ant-collapse-item
    > .ant-collapse-header
    .ant-collapse-arrow {
    right: ${({ theme }) => theme.gridUnit * -50}px;
  }
  .ant-collapse > .ant-collapse-item > .ant-collapse-header {
    padding-left: 10px;
  }
  .form-control.input-sm {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  .ant-collapse-item {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }
  .ant-collapse-item.ant-collapse-item-active {
    .anticon.anticon-right.ant-collapse-arrow > svg {
      transform: rotate(-90deg) !important;
    }
  }
  .header {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
  }
`;

const maxNumColumns = 50;

const DataSourceMetrics = ({
  datasource,
  controls: { datasource: datasourceControl },
  actions,
}: Props) => {
  const [lists, setColList] = useState({
    columns: datasource.columns,
    metrics: datasource.metrics,
  });
  const search = ({ target: { value } }: { target: { value: string } }) => {
    const columns = datasource.columns.filter(
      obj => obj.column_name.indexOf(value) !== -1,
    );
    const metrics = lists.metrics.filter(
      objs => objs.metric_name.indexOf(value) !== -1,
    );
    if (value === '') {
      setColList({ columns: datasource.columns, metrics: datasource.metrics });
    } else setColList({ columns, metrics });
  };
  useEffect(() => {
    setColList({
      columns: datasource.columns,
      metrics: datasource.metrics,
    });
  }, [datasource]);
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
          header={<span className="header">Columns</span>}
          key="column"
        >
          {lists.columns.slice(0, maxNumColumns).map(col => (
            <div key={col.column_name}>
              <ColumnOption showType column={col} />
            </div>
          ))}
          {datasource.columns.length > maxNumColumns && (
            <div className="and-more">...</div>
          )}
        </Collapse.Panel>
      </Collapse>
      <Collapse accordion bordered={false}>
        <Collapse.Panel
          header={<span className="header">Metrics</span>}
          key="metrics"
        >
          {lists.metrics.slice(0, maxNumColumns).map(m => (
            <div key={m.metric_name}>
              <MetricOption metric={m} showType />
            </div>
          ))}
          {datasource.columns.length > maxNumColumns && (
            <div className="and-more">...</div>
          )}
        </Collapse.Panel>
      </Collapse>
    </DatasourceContainer>
  );
};

export default DataSourceMetrics;
