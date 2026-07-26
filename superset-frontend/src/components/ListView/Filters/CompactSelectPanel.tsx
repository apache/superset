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
  type CSSProperties,
  type RefObject,
} from 'react';
import { debounce } from 'lodash-es';
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

// Show search box when there are more than this many static options.
const SEARCH_THRESHOLD = 6;

// Page size for async select fetches — large enough to avoid most pagination
// issues while still being a bounded request. Full infinite-load pagination
// is a future improvement.
const ASYNC_PAGE_SIZE = 200;

interface CompactSelectPanelProps {
  selects?: Filter['selects'];
  fetchSelects?: Filter['fetchSelects'];
  value?: SelectOption;
  onSelect: (option: SelectOption | undefined, isClear?: boolean) => void;
  onClose?: () => void;
  isOpen?: boolean;
  /** Forwarded from the filter config's popupStyle for per-filter width overrides */
  panelStyle?: CSSProperties;
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
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
    padding: 0 0 ${theme.paddingXXS}px;
  `}
`;

const SearchRow = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px
      ${theme.paddingXXS}px;
  `}
`;

const OptionList = styled.ul`
  ${({ theme }) => css`
    margin: 0;
    padding: ${theme.paddingXXS}px 0;
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
    padding: ${(theme.controlHeight - theme.fontSize * theme.lineHeight) / 2}px
      ${theme.controlPaddingHorizontal}px;
    line-height: ${theme.lineHeight};
    cursor: pointer;
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    transition: background 0.15s;

    &:hover {
      background: ${
        $active ? theme.colorPrimaryBgHover : theme.colorFillTertiary
      };
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
    panelStyle,
  }: CompactSelectPanelProps,
  ref: RefObject<FilterHandler>,
) {
  const theme = useTheme();
  const inputRef = useRef<InputRef>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<SelectOption[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

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
    fetchSelects(debouncedSearch, 0, ASYNC_PAGE_SIZE)
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

  const showSearch = !!fetchSelects || selects.length > SEARCH_THRESHOLD;

  const handleSelect = (opt: SelectOption, displayText?: string) => {
    const isDeselect = value?.value === opt.value;
    // Normalize to a plain string label for URL serialization:
    // 1. String labels pass through unchanged.
    // 2. ReactNode labels with a `title` field use that (set by callers for
    //    options like owner-select where label contains name + email JSX).
    // 3. Fall back to DOM text content, then stringified value.
    const label =
      typeof opt.label === 'string'
        ? opt.label
        : (opt.title ?? displayText ?? String(opt.value ?? ''));
    const next = isDeselect ? undefined : { label, value: opt.value };
    onSelect(next, isDeselect);
    onClose?.();
  };

  return (
    <PanelContainer style={panelStyle}>
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
          displayOptions.map((opt, i) => {
            const isActive = value?.value === opt.value;
            const getDisplayText = (el: HTMLElement) =>
              el.textContent?.trim() || undefined;
            const isFirst = i === 0;
            const isLast = i === displayOptions.length - 1;
            return (
              <OptionItem
                key={opt.value}
                $active={isActive}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={e =>
                  handleSelect(opt, getDisplayText(e.currentTarget))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(opt, getDisplayText(e.currentTarget));
                  } else if (e.key === 'ArrowDown' && !isLast) {
                    e.preventDefault();
                    (
                      e.currentTarget.nextElementSibling as HTMLElement | null
                    )?.focus();
                  } else if (e.key === 'ArrowUp' && !isFirst) {
                    e.preventDefault();
                    (
                      e.currentTarget
                        .previousElementSibling as HTMLElement | null
                    )?.focus();
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
