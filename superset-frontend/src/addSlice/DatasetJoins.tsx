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
import _ from 'lodash';
import React, { useState } from 'react';

import { t } from '@superset-ui/core';

import { Button, Col, Row, Tooltip } from 'antd';
import { Select } from 'src/components';

import { FormLabel } from 'src/components/Form';

import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';

import { SelectOptionsType } from 'src/components/Select/types';
import { DatasourceJoin } from './types';

const MAX_JOIN_COLUMNS_LIMIT = 2;

type DatasetJoin = {
  first_column: string;
  second_column: string;
};

const SelectTypes = Object.freeze({
  FIRST_COLUMN: 'first_column',
  SECOND_COLUMN: 'second_column',
});

interface DatasetJoinsProps {
  index: number;
  firstColumn: string;
  secondColumn: string;
  firstDatasetName: string;
  secondDatasetName: string;
  datasetJoins: DatasourceJoin[];
  firstColumnOptions: SelectOptionsType;
  secondColumnOptions: SelectOptionsType;
  changeDatasourceJoin: (datasetJoin: DatasetJoin[]) => void;
}

function DatasetJoins({
  index,
  firstColumn,
  datasetJoins,
  secondColumn,
  firstDatasetName,
  secondDatasetName,
  firstColumnOptions,
  secondColumnOptions,
  changeDatasourceJoin,
}: DatasetJoinsProps) {
  const [columnFirst, setColumnFirst] = useState(firstColumn);
  const [columnSecond, setColumnSecond] = useState(secondColumn);

  function handleSelectChange(value: string, selectType: string) {
    const datasets = _.cloneDeep(datasetJoins);
    datasets[index][selectType] = value;
    changeDatasourceJoin(datasets);
  }

  function addEmptyJoin() {
    const joins = _.cloneDeep(datasetJoins);
    joins.push({ first_column: '', second_column: '' });
    changeDatasourceJoin(joins);
  }

  function removeJoin(index: number) {
    const joins = _.cloneDeep(datasetJoins);
    joins.splice(index, 1);
    changeDatasourceJoin(joins);
  }

  function isButtonDisabled() {
    return !(columnFirst && columnSecond);
  }

  function showAddButton() {
    return (
      datasetJoins?.length - 1 === index &&
      datasetJoins?.length < MAX_JOIN_COLUMNS_LIMIT
    );
  }

  function getHeaderName(datasetName: string) {
    return `${datasetName} Column`;
  }

  return (
    <Row gutter={16} style={{ marginBottom: 8 }} align="middle">
      <Col offset={1} className="gutter-row" span={5}>
        <Select
          autoFocus
          showSearch
          value={firstColumn || undefined}
          ariaLabel={t('Column')}
          name="select-first-column"
          options={firstColumnOptions}
          placeholder={`Choose ${firstDatasetName} column`}
          header={<FormLabel>{getHeaderName(firstDatasetName)}</FormLabel>}
          onChange={value => {
            setColumnFirst(value.toString());
            handleSelectChange(value.toString(), SelectTypes.FIRST_COLUMN);
          }}
        />
      </Col>
      <Col className="gutter-row" span={5}>
        <Select
          showSearch
          value={secondColumn || undefined}
          ariaLabel={t('Column')}
          name="select-second-column"
          options={secondColumnOptions}
          placeholder={`Choose ${secondDatasetName} column`}
          header={<FormLabel>{getHeaderName(secondDatasetName)}</FormLabel>}
          onChange={value => {
            setColumnSecond(value.toString());
            handleSelectChange(value.toString(), SelectTypes.SECOND_COLUMN);
          }}
        />
      </Col>
      {datasetJoins?.length !== 1 && (
        <Tooltip title="Delete JOIN Columns">
          <Button
            type="text"
            size="small"
            shape="circle"
            style={{ marginTop: 20 }}
            icon={<MinusCircleOutlined />}
            onClick={() => removeJoin(index)}
          />
        </Tooltip>
      )}
      {showAddButton() && (
        <Tooltip title="Add JOIN Columns">
          <Button
            type="text"
            size="small"
            shape="circle"
            onClick={addEmptyJoin}
            style={{ marginTop: 20 }}
            disabled={isButtonDisabled()}
            icon={<PlusCircleOutlined />}
          />
        </Tooltip>
      )}
    </Row>
  );
}

export default DatasetJoins;
