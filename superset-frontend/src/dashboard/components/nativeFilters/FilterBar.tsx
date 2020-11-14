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
import { PlusOutlined } from '@ant-design/icons';
import { styled } from '@superset-ui/core';
import React from 'react';
import { Button, Form, Input } from 'src/common/components';
import CreateFilterButton from './CreateFilterButton';
import {
  useFilterConfigurations,
  useFilterSetter,
  useFilterState,
} from './state';
import { Filter } from './types';

const Bar = styled.div`
  display: flex;
  flex-direction: column;
  width: 250px; // arbitrary...
  flex-grow: 1;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const TitleArea = styled.h2`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 0;
`;

interface FilterProps {
  filter: Filter;
}

const FilterValue: React.FC<FilterProps> = ({ filter }) => {
  // THIS ONE IS BUILT TO THROW AWAY
  // this is a temporary POC implementation just to get state hooked up.
  // Please don't send this component to prod.
  const { selectedValues } = useFilterState(filter.id);
  const setSelectedValues = useFilterSetter(filter.id);

  if (selectedValues) {
    return (
      <span>
        {selectedValues.join(', ')}
        <button type="button" onClick={() => setSelectedValues(null)}>
          X
        </button>
      </span>
    );
  }
  return (
    <Form
      onFinish={values => {
        setSelectedValues(values.value);
      }}
    >
      <Form.Item name="value">
        <Input />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        apply
      </Button>
    </Form>
  );
};

const FilterControl: React.FC<FilterProps> = ({ filter }) => {
  return (
    <div>
      <h3>{filter.name}</h3>
      <FilterValue filter={filter} />
    </div>
  );
};

const FilterBar: React.FC = () => {
  const filterConfigs = useFilterConfigurations();
  return (
    <Bar>
      <TitleArea>
        <span>Filters ({filterConfigs.length})</span>
        <CreateFilterButton type="text" shape="circle">
          <PlusOutlined />
        </CreateFilterButton>
      </TitleArea>
      {filterConfigs.map(filter => (
        <FilterControl key={filter.id} filter={filter} />
      ))}
    </Bar>
  );
};

export default FilterBar;
