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
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  type RefObject,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme, styled, css } from '@apache-superset/core/theme';
import { Icons, Input } from '@superset-ui/core/components';
import type { SelectOption, ListViewFilter as Filter } from '../types';
import type { FilterHandler } from './types';

interface CompactSelectPanelProps {
  selects?: Filter['selects'];
  fetchSelects?: Filter['fetchSelects'];
  value?: SelectOption;
  onSelect: (option: SelectOption | undefined, isClear?: boolean) => void;
  onClose?: () => void;
}

const PanelContainer = styled.div`
  ${({ theme }) => css`
    min-width: 200px;
    max-width: 320px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    border-radius: ${theme.borderRadius}px;
    overflow: hidden;
    background: ${theme.colorBgContainer};
    box-shadow: ${theme.boxShadowSecondary};
  `}
`;

const SearchRow = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const OptionList = styled.ul`
  ${({ theme }) => css`
    margin: 0;
    padding: ${theme.sizeUnit}px 0;
    overflow-y: auto;
    flex: 1;
    list-style: none;
  `}
`;

const OptionItem = styled.li<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 3}px;
    cursor: pointer;
    font-size: ${theme.fontSizeSM}px;
    color: ${$active ? theme.colorPrimary : theme.colorText};
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    transition: background 0.15s;

    &:hover {
      background: ${$active ? theme.colorPrimaryBgHover : theme.colorFillAlter};
    }
  `}
`;

const OptionLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
`;

const StatusText = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px;
    text-align: center;
    color: ${theme.colorTextDescription};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

function CompactSelectPanel(
  {
    selects = [],
    fetchSelects,
    value,
    onSelect,
    onClose,
  }: CompactSelectPanelProps,
  ref: RefObject<FilterHandler>,
) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<
    SelectOption | undefined
  >(value);

  // Sync selected state when external value changes (e.g. clearFilters called from parent)
  useEffect(() => {
    setSelectedOption(value);
  }, [value]);

  // Fetch remote options on mount and when search changes
  useEffect(() => {
    if (!fetchSelects) return;
    setLoading(true);
    fetchSelects(search, 0, 50)
      .then(result => {
        setRemoteOptions(result.data);
      })
      .finally(() => setLoading(false));
  }, [search, fetchSelects]);

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setSelectedOption(undefined);
      setSearch('');
      onSelect(undefined, true);
    },
  }));

  const displayOptions = fetchSelects
    ? remoteOptions
    : selects.filter(o => {
        const label = typeof o.label === 'string' ? o.label : String(o.value);
        return label.toLowerCase().includes(search.toLowerCase());
      });

  // Show search for async selects or large static lists
  const showSearch = !!fetchSelects || selects.length > 6;

  const handleSelect = (opt: SelectOption) => {
    const isDeselect = selectedOption?.value === opt.value;
    const next = isDeselect ? undefined : opt;
    setSelectedOption(next);
    onSelect(next, isDeselect);
    onClose?.();
  };

  return (
    <PanelContainer>
      {showSearch && (
        <SearchRow>
          <Input
            size="small"
            prefix={
              <Icons.SearchOutlined
                iconSize="s"
                iconColor={theme.colorTextDescription}
              />
            }
            placeholder={t('Search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            autoFocus
          />
        </SearchRow>
      )}
      <OptionList>
        {loading ? (
          <StatusText>{t('Loading...')}</StatusText>
        ) : displayOptions.length === 0 ? (
          <StatusText>{t('No results')}</StatusText>
        ) : (
          displayOptions.map(opt => {
            const isActive = selectedOption?.value === opt.value;
            return (
              <OptionItem
                key={opt.value}
                $active={isActive}
                onClick={() => handleSelect(opt)}
              >
                <OptionLabel>{opt.label}</OptionLabel>
                {isActive && (
                  <Icons.CheckOutlined
                    iconSize="s"
                    iconColor={theme.colorPrimary}
                  />
                )}
              </OptionItem>
            );
          })
        )}
      </OptionList>
    </PanelContainer>
  );
}

export default forwardRef(CompactSelectPanel);
