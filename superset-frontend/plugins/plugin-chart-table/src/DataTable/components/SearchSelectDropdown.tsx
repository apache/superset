/* eslint-disable import/no-extraneous-dependencies */
import { styled, t } from '@superset-ui/core';
import { Select } from 'src/components';
import { SearchOption } from '../DataTable';

const StyledSelect = styled(Select)`
  width: 120px;
  margin-right: 8px;
`;

interface SearchSelectDropdownProps {
  value?: string;
  onChange: (searchCol: string) => void;
  searchOptions: SearchOption[];
}

function SearchSelectDropdown({
  value,
  onChange,
  searchOptions,
}: SearchSelectDropdownProps) {
  return (
    <StyledSelect
      ariaLabel={t('Search column')}
      value={value || searchOptions?.[0]?.value}
      options={searchOptions}
      onChange={(value: string) => {
        onChange(value);
      }}
    />
  );
}

export default SearchSelectDropdown;
