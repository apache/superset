import _ from 'lodash';
import React, { useState } from 'react';

import { t } from '@superset-ui/core';

import { Button, Col, Row, Tooltip } from 'antd';
import { Select } from 'src/components';

import { FormLabel } from 'src/components/Form';
import { OptionsType } from 'src/components/Select/Select';

import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';

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
  firstColumnOptions: OptionsType;
  secondColumnOptions: OptionsType;
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
          header={<FormLabel>{t(`${firstDatasetName} Column`)}</FormLabel>}
          onChange={value => {
            setColumnFirst(value);
            handleSelectChange(value, SelectTypes.FIRST_COLUMN);
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
          header={<FormLabel>{t(`${secondDatasetName} Column`)}</FormLabel>}
          onChange={value => {
            setColumnSecond(value);
            handleSelectChange(value, SelectTypes.SECOND_COLUMN);
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
