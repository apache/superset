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
import { Button } from 'src/common/components';
import { useFilterConfigurations } from './state';

interface FiltersListProps {
  setEditFilter: (arg0: any) => void;
  showEdit: (arg0: boolean) => void;
  setDataset: (arg0: any) => void;
}

const FiltersList = ({
  setEditFilter,
  showEdit,
  setDataset,
}: FiltersListProps) => {
  const filterConfigs = useFilterConfigurations();
  return (
    <>
      {filterConfigs.map(filter => (
        <Button
          onClick={() => {
            setEditFilter(filter);
            showEdit(true);
            setDataset(filter.targets[0].datasetId);
          }}
          role="button"
        >
          {filter.name}
        </Button>
      ))}
    </>
  );
};

export default FiltersList;
