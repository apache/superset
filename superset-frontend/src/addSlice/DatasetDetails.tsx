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
import React from 'react';

import _ from 'lodash';
import { t } from '@superset-ui/core';

import { Select, AsyncSelect } from 'src/components';
import { Button, Col, Row, Tooltip } from 'antd';
import { FormLabel } from 'src/components/Form';

import { MinusCircleOutlined } from '@ant-design/icons';

import {
  SelectOptionsType,
  SelectOptionsPagePromise,
} from 'src/components/Select/types';
import {
  StyledLabel,
  StyledStepDescription,
  TooltipContent,
} from './AddSliceContainer';

import {
  DatasourceJoins,
  DatasourceJoin,
  AdditionalStateDataset,
} from './types';

import DatasetJoins from './DatasetJoins';

interface DatasetDetailsProps {
  index: number;
  firstDatasetName: string;
  joinOptions: SelectOptionsType;
  dataset: AdditionalStateDataset;
  datasets: AdditionalStateDataset[];
  datasourceJoins: DatasourceJoins[];
  firstDatasourceColumns: SelectOptionsType;
  datasetOptions: SelectOptionsPagePromise;
  changeDatasourceJoins: (datasourceJoins: DatasourceJoins[]) => void;
  changeAdditionalDatasource: (datasets: AdditionalStateDataset[]) => void;
}

function DatasetDetails({
  index,
  dataset,
  datasets,
  joinOptions,
  datasetOptions,
  datasourceJoins,
  firstDatasetName,
  changeDatasourceJoins,
  firstDatasourceColumns,
  changeAdditionalDatasource,
}: DatasetDetailsProps) {
  function changeDatasource(
    { value, label }: { value: string; label: string },
    database: any,
  ) {
    const updatedDataset = {
      value,
      label,
      schema: database.schema,
      table_name: database.table_name,
      database_name: database.database_name,
      column_names: database.column_names,
      join_type: dataset.join_type,
    };
    const additional_datasources = [...datasets];
    additional_datasources[index] = updatedDataset;
    changeAdditionalDatasource(additional_datasources);
  }

  function customLabel(value: string) {
    return (
      <Tooltip
        mouseEnterDelay={1}
        placement="right"
        title={
          <TooltipContent hasDescription={false}>
            <div className="tooltip-header">{value}</div>
          </TooltipContent>
        }
      >
        <StyledLabel>{value}</StyledLabel>
      </Tooltip>
    );
  }

  function changeJoinType(joinType: string) {
    const additional_datasources = [...datasets];
    additional_datasources[index].join_type = joinType;
    changeAdditionalDatasource(additional_datasources);
  }

  function getFirstColumnOptions() {
    return index === 0
      ? firstDatasourceColumns
      : datasets[index - 1].column_names?.map(column => ({
          value: column,
          label: column,
          customLabel: customLabel(column),
        }));
  }

  function getSecondColumnOptions() {
    return datasets[index].column_names?.map(column => ({
      value: column,
      label: column,
      customLabel: customLabel(column),
    }));
  }

  function getFirstDatasetName() {
    return index === 0 ? firstDatasetName : datasets[index - 1].table_name;
  }

  function getSecondDatasetName() {
    return datasets[index].table_name;
  }

  function isButtonDisabled() {
    const { first_column, second_column } = datasourceJoins[index][0];
    return !(dataset.value && first_column && second_column);
  }

  function changeDatasourceJoin(datasourceJoin: DatasourceJoin[]) {
    const updatedJoins = _.cloneWith(datasourceJoins);
    updatedJoins[index] = datasourceJoin;
    changeDatasourceJoins(updatedJoins);
  }

  function addEmptyDataset() {
    const joins = _.cloneDeep(datasourceJoins);
    joins.push([{ first_column: '', second_column: '' }]);
    changeAdditionalDatasource([...datasets, { join_type: 'INNER JOIN' }]);
    changeDatasourceJoins(joins);
  }

  function removeDataset(index: number) {
    const additional_datasources = [...datasets];
    const joins = _.cloneDeep(datasourceJoins);
    additional_datasources.splice(index, 1);
    joins.splice(index, 1);
    changeAdditionalDatasource(additional_datasources);
    changeDatasourceJoins(joins);
  }

  return (
    <>
      <Col
        span={4}
        offset={1}
        className="gutter-row"
        style={{ marginBottom: 8 }}
      >
        <Select
          showSearch
          options={joinOptions}
          ariaLabel={t('JOIN')}
          name="select-join-type"
          value={dataset.join_type}
          onChange={changeJoinType}
          placeholder={t('Choose a JOIN')}
          header={<FormLabel>{t('JOIN')}</FormLabel>}
        />
      </Col>
      <Row gutter={16} style={{ marginBottom: 8 }} align="middle">
        <Col offset={1} className="gutter-row" span={7}>
          <StyledStepDescription className="dataset">
            <AsyncSelect
              autoFocus
              showSearch
              ariaLabel={t('Dataset')}
              name="select-datasource"
              options={datasetOptions}
              onChange={changeDatasource}
              placeholder={t('Choose a dataset')}
              optionFilterProps={['id', 'label']}
              // @ts-ignore:next-line
              value={dataset?.value ? dataset : undefined}
              header={<FormLabel>{t('Dataset')}</FormLabel>}
            />
          </StyledStepDescription>
        </Col>
        <Tooltip title="Delete Dataset">
          <Button
            type="text"
            size="small"
            shape="circle"
            style={{ marginTop: 20 }}
            icon={<MinusCircleOutlined />}
            onClick={() => removeDataset(index)}
          />
        </Tooltip>
      </Row>
      {dataset.value &&
        datasourceJoins[index].map((datasourceJoin, joinIndex) => (
          <DatasetJoins
            key={joinIndex}
            index={joinIndex}
            datasetJoins={datasourceJoins[index]}
            firstColumn={datasourceJoin.first_column}
            secondColumn={datasourceJoin.second_column}
            changeDatasourceJoin={changeDatasourceJoin}
            firstDatasetName={getFirstDatasetName() || ''}
            secondDatasetName={getSecondDatasetName() || ''}
            firstColumnOptions={getFirstColumnOptions() || []}
            secondColumnOptions={getSecondColumnOptions() || []}
          />
        ))}
      {datasets.length - 1 === index && !isButtonDisabled() && (
        <Row
          gutter={16}
          align="middle"
          style={{ marginTop: 16, marginBottom: 8 }}
        >
          <Col>
            <Button
              size="small"
              shape="round"
              type="primary"
              onClick={addEmptyDataset}
            >
              Add Dataset
            </Button>
          </Col>
        </Row>
      )}
    </>
  );
}

export default DatasetDetails;
