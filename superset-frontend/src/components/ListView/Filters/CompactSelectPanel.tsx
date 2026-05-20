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
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
  type RefObject,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Select, AsyncSelect } from '@superset-ui/core/components';
import type { SelectOption, ListViewFilter as Filter } from '../types';
import type { FilterHandler } from './types';

interface CompactSelectPanelProps {
  selects?: Filter['selects'];
  fetchSelects?: Filter['fetchSelects'];
  value?: SelectOption;
  onSelect: (option: SelectOption | undefined, isClear?: boolean) => void;
  onClose?: () => void;
  /** Injected by CompactFilterTrigger via cloneElement — true when the outer dropdown is open */
  isOpen?: boolean;
  /** External loading state from filter config */
  loading?: boolean;
}

/**
 * Shows only the dropdown portion of Select/AsyncSelect by hiding the trigger
 * via a zero-height wrapper and rendering the dropdown inside a container div
 * via getPopupContainer. This gives the same visual as Explore's select dropdowns.
 */
const Container = styled.div`
  position: relative;
`;

const HiddenWrapper = styled.div`
  position: absolute;
  height: 0;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
`;

function CompactSelectPanel(
  {
    selects = [],
    fetchSelects,
    value,
    onSelect,
    onClose,
    isOpen,
    loading,
  }: CompactSelectPanelProps,
  ref: RefObject<FilterHandler>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = useState<
    SelectOption | undefined
  >(value);

  // Sync when external value changes (e.g. clearFilters from parent)
  useEffect(() => {
    setSelectedOption(value);
  }, [value]);

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setSelectedOption(undefined);
      onSelect(undefined, true);
    },
  }));

  const handleChange = useCallback(
    (selected: SelectOption | undefined) => {
      // Normalize to plain {label: string, value} to avoid circular-ref errors
      // when emotion-styled ReactNode labels are URL-serialized.
      const next = selected
        ? {
            label:
              typeof selected.label === 'string'
                ? selected.label
                : String(selected.value ?? ''),
            value: selected.value,
          }
        : undefined;
      setSelectedOption(next);
      onSelect(next, !selected);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const handleOpenChange = useCallback(
    (visible: boolean) => {
      if (!visible) onClose?.();
    },
    [onClose],
  );

  const getPopupContainer = useCallback(
    () => containerRef.current ?? document.body,
    [],
  );

  const fetchAndFormat = useMemo(
    () =>
      fetchSelects
        ? async (inputValue: string, page: number, pageSize: number) => {
            const result = await fetchSelects(inputValue, page, pageSize);
            return {
              data: result?.data ?? [],
              totalCount: result?.totalCount ?? 0,
            };
          }
        : undefined,
    [fetchSelects],
  );

  const placeholder = t('Search');

  return (
    <Container ref={containerRef}>
      <HiddenWrapper>
        {fetchSelects ? (
          <AsyncSelect
            open={isOpen}
            value={selectedOption}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={handleChange as any}
            options={fetchAndFormat!}
            getPopupContainer={getPopupContainer}
            onOpenChange={handleOpenChange}
            showSearch
            allowClear
            loading={loading}
            placeholder={placeholder}
            ariaLabel={placeholder}
            labelInValue
          />
        ) : (
          <Select
            open={isOpen}
            value={selectedOption}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={handleChange as any}
            options={selects}
            getPopupContainer={getPopupContainer}
            onOpenChange={handleOpenChange}
            showSearch={selects.length > 6}
            allowClear
            loading={loading}
            placeholder={placeholder}
            ariaLabel={placeholder}
            labelInValue
          />
        )}
      </HiddenWrapper>
    </Container>
  );
}

export default forwardRef(CompactSelectPanel);
