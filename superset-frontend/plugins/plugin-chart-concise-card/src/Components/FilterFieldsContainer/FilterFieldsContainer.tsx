import React from 'react';
import SearchDropDown from '../SearchDropDown/SearchDropDown';
import { styled } from '@superset-ui/core';
import { FilterFieldData } from '../../types';

const WrapperComponent = styled.div`
  position: relative;
  top: 15px;
  width: 270px;
  height: 30px;
`;

export default function FilterFieldsContainer(props: { filterFieldsData: [FilterFieldData] }) {
  const { filterFieldsData } = props;

  const transformedFilters = filterFieldsData.map((data: FilterFieldData, i: number) => {
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
  });

  return <div>{transformedFilters}</div>;
}
