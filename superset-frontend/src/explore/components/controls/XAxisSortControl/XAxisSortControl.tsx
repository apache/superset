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
import React, { useState, useEffect, useMemo } from 'react';
import { t, UnsortedXAxis } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import Label from 'src/components/Label';
import ControlPopover from 'src/explore/components/controls/ControlPopover/ControlPopover';
import { AntdCheckbox, Select } from 'src/components';
import { xAxisSortControlProps } from './types';

export default function XAxisSortControl({
  xAxisSortByOptions,
  value,
  onChange,
  label,
  description,
}: xAxisSortControlProps) {
  const [labelOnControl, setLabelOnControl] = useState<string>(
    value.sortByLabel === UnsortedXAxis
      ? value.sortByLabel
      : `${value.sortByLabel} (${value.isAsc ? 'Asc' : 'Desc'})`,
  );
  const [sortByLabel, setSortByLabel] = useState<string>(value.sortByLabel);
  const [isAsc, setIsAsc] = useState<boolean>(value.isAsc);

  useEffect(() => {
    onChange({
      sortByLabel,
      isAsc,
    });
    setLabelOnControl(
      sortByLabel === UnsortedXAxis
        ? UnsortedXAxis
        : `${sortByLabel} (${isAsc ? 'Asc' : 'Desc'})`,
    );
  }, [sortByLabel, isAsc]);

  // if the xAxisSortByOptions has been changed and
  // sortByLabel isn't in the `options`, sortByLabel and LabelOnControl will be reset.
  useEffect(() => {
    if (
      !xAxisSortByOptions
        .map(option => option.value)
        .includes(value.sortByLabel)
    ) {
      setSortByLabel(UnsortedXAxis);
      setLabelOnControl(UnsortedXAxis);
    }
  }, [xAxisSortByOptions]);

  const popoverContent = useMemo(
    () => (
      <>
        <div className="control-label">{t('SORT BY')}</div>
        <Select
          ariaLabel={t('SORT BY')}
          options={xAxisSortByOptions}
          value={sortByLabel}
          onChange={(val: string) => setSortByLabel(val)}
        />

        <AntdCheckbox
          checked={isAsc}
          onChange={e => setIsAsc(e.target.checked)}
        >
          {t('Ascending')}
        </AntdCheckbox>
      </>
    ),
    [isAsc, sortByLabel, xAxisSortByOptions],
  );

  return (
    <>
      <ControlHeader label={label} description={description} />
      <ControlPopover
        placement="right"
        trigger="click"
        content={popoverContent}
        title={t('X-Axis Sort By')}
        overlayStyle={{ width: '300px' }}
      >
        <Label className="pointer">{labelOnControl}</Label>
      </ControlPopover>
    </>
  );
}
