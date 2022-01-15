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
import SearchDropDown from '../SearchDropDown/SearchDropDown';
import { FilterFieldData } from '../../types';

const WrapperComponent = styled.div`
  position: relative;
  top: 15px;
  width: 270px;
  height: 30px;
`;

export default function FilterFieldsContainer(props: {
  filterFieldsData: [FilterFieldData];
}) {
  const { filterFieldsData } = props;

  const transformedFilters = filterFieldsData.map(
    (data: FilterFieldData, i: number) => {
      const { filterData, filterValue, setFilterValue, queriedValue } = data;
      const columnName = filterData.colnames[0];

      const categoryArray: string[] = filterData.data.map(c => c[columnName]);

      return (
        <WrapperComponent>
          <SearchDropDown
            key={i}
            defaultValue={queriedValue || 'select filter value'}
            name={columnName}
            values={categoryArray}
            selectedValue={filterValue}
            setSelectedValue={setFilterValue}
          />
        </WrapperComponent>
      );
    },
  );

  return <div>{transformedFilters}</div>;
}
