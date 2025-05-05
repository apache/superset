/* eslint-disable import/no-extraneous-dependencies */
import { styled, t } from '@superset-ui/core';
import { Select } from 'src/components';
import { Column } from 'react-table';

const StyledSelect = styled(Select)`
  width: 120px;
  margin-right: 8px;
`;

interface SearchSelectDropdownProps<D extends object> {
  columns: Column<D> & { columnKey: string }[];
  value?: string;
  onChange: (column: string) => void;
}

function SearchSelectDropdown<D extends object>({
  columns,
  value,
  onChange,
}: SearchSelectDropdownProps<D>) {
  const options = columns.map(column => ({
    value: column.columnKey,
    label: column?.columnKey,
  }));

  return (
    <StyledSelect
      ariaLabel={t('Search column')}
      value={value || options[0]?.value}
      options={options}
      onChange={(value: string) => {
        onChange(value);
      }}
      placeholder={t('Search column...')}
    />
  );
}

export default SearchSelectDropdown;
