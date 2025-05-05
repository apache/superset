/* eslint-disable import/no-extraneous-dependencies */
import { styled, t } from '@superset-ui/core';
import { Select } from 'src/components';
import { ColumnWithLooseAccessor } from 'react-table';

const StyledSelect = styled(Select)`
  width: 120px;
  margin-right: 8px;
`;

interface SearchSelectDropdownProps<D extends object> {
  columns: ColumnWithLooseAccessor<D> &
    { columnKey: string; sortType: string }[];
  value?: string;
  onChange: (column: string) => void;
}

function SearchSelectDropdown<D extends object>({
  columns,
  value,
  onChange,
}: SearchSelectDropdownProps<D>) {
  const options = columns
    .filter(col => col?.sortType === 'alphanumeric')
    .map(column => ({
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
    />
  );
}

export default SearchSelectDropdown;
