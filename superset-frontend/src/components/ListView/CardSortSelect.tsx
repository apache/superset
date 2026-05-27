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
import { useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import type { SelectOption } from './types';
import { CardSortSelectOption, SortColumn } from './types';
import CompactFilterTrigger from './Filters/CompactFilterTrigger';
import CompactSelectPanel from './Filters/CompactSelectPanel';
import type { FilterHandler } from './Filters/types';

interface CardViewSelectSortProps {
  onChange: (value: SortColumn[]) => void;
  options: Array<CardSortSelectOption>;
  initialSort?: SortColumn[];
}

export const CardSortSelect = ({
  initialSort,
  onChange,
  options,
}: CardViewSelectSortProps) => {
  const panelRef = useRef<FilterHandler>(null);

  const defaultSort =
    (initialSort &&
      options.find(
        ({ id, desc }) =>
          id === initialSort[0].id && desc === initialSort[0].desc,
      )) ||
    options[0];

  const [currentValue, setCurrentValue] = useState<SelectOption>({
    label: defaultSort.label,
    value: defaultSort.value,
  });

  const selectOptions = options.map(o => ({ label: o.label, value: o.value }));

  // Sort always has an active value — the control is meaningless without one.
  // Show the active option in the label so users always know what sort is applied.
  const isNonDefault = currentValue.value !== options[0]?.value;

  const handleSelect = (option: SelectOption | undefined) => {
    if (!option) return;
    const original = options.find(o => o.value === option.value);
    if (original) {
      setCurrentValue({ label: original.label, value: original.value });
      onChange([{ id: original.id, desc: original.desc }]);
    }
  };

  const handleClear = () => {
    const first = options[0];
    if (first) {
      setCurrentValue({ label: first.label, value: first.value });
      onChange([{ id: first.id, desc: first.desc }]);
    }
  };

  // Always show the active sort name so users can see what's applied.
  // The pill is always "active" (hasValue=true) because a sort is always in
  // effect — there is no "no sort" state. Clearing resets to options[0], not
  // to an unsorted state, so we only hide the X when already at the default.
  const pillLabel = `${t('Sort')}: ${String(currentValue.label)}`;

  return (
    <span data-test="card-sort-select">
      <CompactFilterTrigger
        label={pillLabel}
        hasValue={isNonDefault}
        onClear={handleClear}
        tooltipTitle={undefined}
      >
        {({ isOpen, onClose }) => (
          <CompactSelectPanel
            ref={panelRef}
            selects={selectOptions}
            value={currentValue}
            onSelect={handleSelect}
            isOpen={isOpen}
            onClose={onClose}
          />
        )}
      </CompactFilterTrigger>
    </span>
  );
};
