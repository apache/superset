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
// import shortid from 'shortid';
import { setFilterConfiguration } from 'src/dashboard/actions/nativeFilters';
import { FilterConfigModal } from './FilterConfigModal';
import { FilterConfiguration } from './types';

export interface FCBProps {
  createNewOnOpen?: boolean;
}

export const FilterConfigurationLink: React.FC<FCBProps> = ({
  createNewOnOpen,
  children,
}) => {
  const dispatch = useDispatch();
  const [isOpen, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  async function submit(filterConfig: FilterConfiguration) {
    await dispatch(setFilterConfiguration(filterConfig));
    close();
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onClick={() => setOpen(true)}>{children}</div>
      <FilterConfigModal
        isOpen={isOpen}
        save={submit}
        onCancel={close}
        createNewOnOpen={createNewOnOpen}
      />
    </>
  );
};

export default FilterConfigurationLink;
