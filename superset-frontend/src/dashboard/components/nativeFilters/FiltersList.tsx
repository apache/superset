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
import { styled } from '@superset-ui/core';
import { Button } from 'src/common/components';
import Icon from 'src/components/Icon';
import { useFilterConfiguration } from './state';

interface Args {
  filter: any;
  index: number;
}

interface FiltersListProps {
  setEditFilter: (arg0: Args) => void;
  setDataset: (arg0: any) => void;
}
const FiltersStyle = styled.div`
  display: flex;
  flex-direction: row;
`;

const FiltersList = ({ setEditFilter, setDataset }: FiltersListProps) => {
  const filterConfigs = useFilterConfiguration();
  <>
    {filterConfigs.map((filter, i: number) => (
      <FiltersStyle>
        <Button
          type="link"
          key={filter.name}
          onClick={() => {
            setEditFilter({ filter, index: i });
            setDataset(filter.targets[0].datasetId);
          }}
        >
          {filter.name}
        </Button>
        <span
          role="button"
          title="Edit Dashboard"
          tabIndex={0}
          className="action-button"
        >
          <Icon name="trash" />
        </span>
      </FiltersStyle>
    ))}
  </>;
};

export default FiltersList;
