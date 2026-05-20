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
  useMemo,
  useRef,
  useState,
  useEffect,
  type RefObject,
} from 'react';
import { debounce } from 'lodash';
import { t } from '@apache-superset/core/translation';
import { useTheme, styled, css } from '@apache-superset/core/theme';
import {
  Icons,
  Input,
  Constants,
  type InputRef,
} from '@superset-ui/core/components';
import type { SelectOption, ListViewFilter as Filter } from '../types';
import type { FilterHandler } from './types';

interface CompactSelectPanelProps {
  selects?: Filter['selects'];
  fetchSelects?: Filter['fetchSelects'];
  value?: SelectOption;
  onSelect: (option: SelectOption | undefined, isClear?: boolean) => void;
  onClose?: () => void;
  /** Injected by CompactFilterTrigger via cloneElement — true when dropdown is open */
  isOpen?: boolean;
  /** External loading state from filter config */
  loading?: boolean;
}

const PanelContainer = styled.div`
  ${({ theme }) => css`
    min-width: 220px;
    max-width: 320px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    border-radius: ${theme.borderRadiusLG}px;
    overflow: hidden;
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
    padding: 0 0 ${theme.paddingXXS}px;
  `}
`;

const SearchRow = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px ${theme.paddingXXS}px;
  `}
`;

const OptionList = styled.ul`
  ${({ theme }) => css`
    margin: 0;
    padding: 0;
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
    padding: 5px ${theme.sizeUnit * 3}px;
    cursor: pointer;
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    transition: background 0.15s;

    &:hover {
      background: ${$active
        ? theme.colorPrimaryBgHover
        : theme.colorFillTertiary};
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
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
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    text-align: center;
    color: ${theme.colorTextDisabled};
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
    isOpen,
    loading: externalLoading,
  }: CompactSelectPanelProps,
  ref: RefObject<FilterHandler>,
) {
  const theme = useTheme();
  const inputRef = useRef<InputRef>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<SelectOption[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<
    SelectOption | undefined
  >(value);

  const isLoading = externalLoading || internalLoading;

  const debouncedSetSearch = useMemo(
    () => debounce(setDebouncedSearch, Constants.FAST_DEBOUNCE),
    [],
  );

  useEffect(
    () => () => {
      debouncedSetSearch.cancel();
    },
    [debouncedSetSearch],
  );

  // Sync selected state when external value changes (e.g. clearFilters called from parent)
  useEffect(() => {
    setSelectedOption(value);
  }, [value]);

  // Focus search input when dropdown opens; reset search when it closes
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      timeoutId = setTimeout(() => {
        inputRef.current?.input?.focus({ preventScroll: true });
      }, 100);
    } else {
      setSearch('');
      setDebouncedSearch('');
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);

  // Fetch remote options when debounced search changes
  useEffect(() => {
    if (!fetchSelects) return;
    let cancelled = false;
    setInternalLoading(true);
    fetchSelects(debouncedSearch, 0, 50)
      .then(result => {
        if (!cancelled) setRemoteOptions(result?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRemoteOptions([]);
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, fetchSelects]);

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setSelectedOption(undefined);
      setSearch('');
      setDebouncedSearch('');
      onSelect(undefined, true);
    },
  }));

  const displayOptions = (
    fetchSelects
      ? remoteOptions
      : selects.filter(o => {
          const label = typeof o.label === 'string' ? o.label : String(o.value);
          return label.toLowerCase().includes(search.toLowerCase());
        })
  ).filter(o => o != null);

  // Show search for async selects or large static lists
  const showSearch = !!fetchSelects || selects.length > 6;

  // displayText is the actual rendered text of the clicked list item, captured
  // from the DOM via e.currentTarget.textContent. This is more reliable than
  // reading opt.label, which may be a styled ReactNode (e.g. for owner options)
  // rather than a plain string — causing tooltip to show the raw value instead.
  const handleSelect = (opt: SelectOption, displayText?: string) => {
    const isDeselect = selectedOption?.value === opt.value;
    // Normalize to a plain object so the value can be safely serialized to
    // URL query params without circular-reference errors from emotion metadata
    // on styled ReactNode labels.
    const next = isDeselect
      ? undefined
      : {
          label:
            displayText ||
            (typeof opt.label === 'string' ? opt.label : String(opt.value ?? '')),
          value: opt.value,
        };
    setSelectedOption(next);
    onSelect(next, isDeselect);
    onClose?.();
  };

  return (
    <PanelContainer>
      {showSearch && (
        <SearchRow>
          <Input
            ref={inputRef}
            prefix={
              <Icons.SearchOutlined iconSize="l" iconColor={theme.colorIcon} />
            }
            placeholder={t('Search')}
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              debouncedSetSearch(e.target.value);
            }}
            allowClear
            css={css`
              width: 100%;
              box-shadow: none;
            `}
          />
        </SearchRow>
      )}
      <OptionList role="listbox" aria-label={t('Filter options')}>
        {isLoading ? (
          <StatusText>{t('Loading...')}</StatusText>
        ) : displayOptions.length === 0 ? (
          <StatusText>{t('No results')}</StatusText>
        ) : (
          displayOptions.map(opt => {
            const isActive = selectedOption?.value === opt.value;
            const getDisplayText = (el: HTMLElement) =>
              el.textContent?.trim() || undefined;
            return (
              <OptionItem
                key={opt.value}
                $active={isActive}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={e => handleSelect(opt, getDisplayText(e.currentTarget))}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(opt, getDisplayText(e.currentTarget));
                  }
                }}
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
