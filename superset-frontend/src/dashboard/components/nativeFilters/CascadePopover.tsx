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
import React from 'react';
import { ExtraFormData } from '@superset-ui/core';
import Popover from 'src/common/components/Popover';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import {
  CascadeFilterControl,
  CascadeFilter,
  FilterControl,
} from './FilterBar';
import { Filter } from './types';

interface CascadePopoverProps {
  filter: CascadeFilter;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onExtraFormDataChange: (filter: Filter, extraFormData: ExtraFormData) => void;
}

const CascadePopover: React.FC<CascadePopoverProps> = ({
  filter,
  visible,
  onVisibleChange,
  onExtraFormDataChange,
}) => {
  const title = <span>Select Parent Filters (ilosc poziomow) {filter.id}</span>;

  const content = (
    <CascadeFilterControl
      data-test="cascade-filters-control"
      key={filter.id}
      filter={filter}
      onExtraFormDataChange={onExtraFormDataChange}
    />
  );

  return (
    <>
      {filter.cascadeChildren.length !== 0 && (
        <>
          <Button buttonSize="xs" onClick={() => onVisibleChange(true)}>
            ({filter.cascadeChildren.length})
            <Icon name="filter" />
          </Button>

          <Popover
            content={content}
            title={title}
            trigger="click"
            visible={visible}
            onVisibleChange={onVisibleChange}
            placement="right"
            id={filter.id}
          />
        </>
      )}
      <FilterControl
        filter={filter}
        onExtraFormDataChange={onExtraFormDataChange}
      />
    </>
  );
};

export default CascadePopover;
