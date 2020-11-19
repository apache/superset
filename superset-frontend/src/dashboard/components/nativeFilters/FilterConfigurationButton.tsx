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
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import shortid from 'shortid';
import { Button } from 'src/common/components';
import {
  createFilter,
  setFilterConfiguration,
} from 'src/dashboard/actions/nativeFilters';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { FilterConfigModal } from './FilterConfigModal';
import {
  FilterConfiguration,
  NativeFiltersForm,
  Scope,
  Scoping,
} from './types';

const FilterConfigurationButton: React.FC = ({ children }) => {
  const dispatch = useDispatch();
  const [isOpen, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  async function submit(filterConfig: FilterConfiguration) {
    dispatch(setFilterConfiguration(filterConfig));
    close();
  }

  return (
    <>
      <Button type="text" onClick={() => setOpen(true)}>
        {children}
      </Button>
      <FilterConfigModal isOpen={isOpen} save={submit} onCancel={close} />
    </>
  );
};

export default FilterConfigurationButton;
