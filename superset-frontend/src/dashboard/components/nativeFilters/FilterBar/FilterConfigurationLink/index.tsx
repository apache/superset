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
import { ReactNode, FC, useCallback, useState, memo } from 'react';

import { useDispatch } from 'react-redux';
import { setFilterConfiguration } from 'src/dashboard/actions/nativeFilters';
import FiltersConfigModal from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal';
import { getFilterBarTestId } from '../utils';
import { SaveFilterChangesType } from '../../FiltersConfigModal/types';

export interface FCBProps {
  createNewOnOpen?: boolean;
  dashboardId?: number;
  initialFilterId?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export const FilterConfigurationLink: FC<FCBProps> = ({
  createNewOnOpen,
  dashboardId,
  initialFilterId,
  onClick,
  children,
}) => {
  const dispatch = useDispatch();
  const [isOpen, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const submit = useCallback(
    async (filterChanges: SaveFilterChangesType) => {
      dispatch(await setFilterConfiguration(filterChanges));
      close();
    },
    [dispatch, close],
  );

  const handleClick = useCallback(() => {
    setOpen(true);
    if (onClick) {
      onClick();
    }
  }, [setOpen, onClick]);

  return (
    <>
      <div
        {...getFilterBarTestId('create-filter')}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        {children}
      </div>
      <FiltersConfigModal
        isOpen={isOpen}
        onSave={submit}
        onCancel={close}
        initialFilterId={initialFilterId}
        createNewOnOpen={createNewOnOpen}
        key={`filters-for-${dashboardId}`}
      />
    </>
  );
};

export default memo(FilterConfigurationLink);
