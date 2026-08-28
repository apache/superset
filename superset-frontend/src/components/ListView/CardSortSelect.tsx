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

  const handleSelect = (option: SelectOption | undefined) => {
    if (!option) return;
    const original = options.find(o => o.value === option.value);
    if (original) {
      setCurrentValue({ label: original.label, value: original.value });
      onChange([{ id: original.id, desc: original.desc }]);
    }
  };

  return (
    <span data-test="card-sort-select">
      <CompactFilterTrigger
        label={t('Sort')}
        hasValue={false}
        onClear={() => {}}
        tooltipTitle={String(currentValue.label)}
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
