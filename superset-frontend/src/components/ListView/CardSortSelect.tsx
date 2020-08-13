import React, { useState } from 'react';
import { styled, withTheme, SupersetThemeProps } from '@superset-ui/style';
import { PartialThemeConfig, Select } from 'src/components/Select';
import { CardSortSelectOption, FetchDataConfig, SortColumn } from './types';
import { filterSelectStyles } from './utils';

const SortTitle = styled.label`
  font-weight: bold;
  line-height: 27px;
  margin: 0 0.4em 0 0;
`;

const SortContainer = styled.div`
  display: inline-flex;
  float: right;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  padding: 24px 24px 0 0;
  position: relative;
  top: 8px;
`;
interface CardViewSelectSortProps {
  onChange: (conf: FetchDataConfig) => any;
  options: Array<CardSortSelectOption>;
  initialSort?: SortColumn[];
  pageIndex: number;
  pageSize: number;
}

interface StyledSelectProps {
  onChange: (value: CardSortSelectOption) => void;
  options: CardSortSelectOption[];
  selectStyles: any;
  theme: SupersetThemeProps['theme'];
  value: CardSortSelectOption;
}

function StyledSelect({
  onChange,
  options,
  selectStyles,
  theme,
  value,
}: StyledSelectProps) {
  const filterSelectTheme: PartialThemeConfig = {
    spacing: {
      baseUnit: 1,
      fontSize: theme.typography.sizes.s,
      minWidth: '5em',
    },
  };
  return (
    <Select
      data-test="card-sort-select"
      clearable={false}
      onChange={onChange}
      options={options}
      stylesConfig={selectStyles}
      themeConfig={filterSelectTheme}
      value={value}
    />
  );
}

const StyledCardSortSelect = withTheme(StyledSelect);

export const CardSortSelect = ({
  initialSort,
  onChange,
  options,
  pageIndex,
  pageSize,
}: CardViewSelectSortProps) => {
  const defaultSort =
    initialSort && options.find(({ id }) => id === initialSort[0].id);
  const [selectedOption, setSelectedOption] = useState<CardSortSelectOption>(
    defaultSort || options[0],
  );

  const handleOnChange = (selected: CardSortSelectOption) => {
    setSelectedOption(selected);
    const sortBy = [{ id: selected.id, desc: selected.desc }];
    onChange({ pageIndex, pageSize, sortBy, filters: [] });
  };

  return (
    <SortContainer>
      <SortTitle>Sort:</SortTitle>
      <StyledCardSortSelect
        onChange={(value: CardSortSelectOption) => handleOnChange(value)}
        options={options}
        selectStyles={filterSelectStyles}
        value={selectedOption}
      />
    </SortContainer>
  );
};
