// DODO was here
import {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type RefObject,
} from 'react';

import { t } from '@superset-ui/core';
import { Select } from 'src/components';
import { Filter, SelectOption } from 'src/components/ListView/types';
import { FormLabel } from 'src/components/Form';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { FilterContainer, BaseFilter, FilterHandler } from './Base';

interface SelectFilterPropsDodoExtended {
  width?: number; // DODO added 44211759
}
interface SelectFilterProps extends BaseFilter, SelectFilterPropsDodoExtended {
  fetchSelects?: Filter['fetchSelects'];
  name?: string;
  onSelect: (selected: SelectOption | undefined, isClear?: boolean) => void;
  paginate?: boolean;
  selects: Filter['selects'];
}

function SelectFilter(
  {
    Header,
    name,
    fetchSelects,
    initialValue,
    onSelect,
    selects = [],
    width, // DODO added 44211759
  }: SelectFilterProps,
  ref: RefObject<FilterHandler>,
) {
  const [selectedOption, setSelectedOption] = useState(initialValue);

  const onChange = (selected: SelectOption) => {
    onSelect(
      selected ? { label: selected.label, value: selected.value } : undefined,
    );
    setSelectedOption(selected);
  };

  const onClear = () => {
    onSelect(undefined, true);
    setSelectedOption(undefined);
  };

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      onClear();
    },
  }));

  const fetchAndFormatSelects = useMemo(
    () => async (inputValue: string, page: number, pageSize: number) => {
      if (fetchSelects) {
        const selectValues = await fetchSelects(inputValue, page, pageSize);
        return {
          data: selectValues.data,
          totalCount: selectValues.totalCount,
        };
      }
      return {
        data: [],
        totalCount: 0,
      };
    },
    [fetchSelects],
  );

  return (
    // DODO changed 44211759
    <FilterContainer width={width}>
      {fetchSelects ? (
        <AsyncSelect
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          header={<FormLabel>{Header}</FormLabel>}
          onChange={onChange}
          onClear={onClear}
          options={fetchAndFormatSelects}
          placeholder={t('Select or type a value')}
          showSearch
          value={selectedOption}
        />
      ) : (
        <Select
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          header={<FormLabel>{Header}</FormLabel>}
          labelInValue
          onChange={onChange}
          onClear={onClear}
          options={selects}
          placeholder={t('Select or type a value')}
          showSearch
          value={selectedOption}
        />
      )}
    </FilterContainer>
  );
}
export default forwardRef(SelectFilter);
