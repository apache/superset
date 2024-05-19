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
import Button from 'src/components/Button';
import { FilterConfiguration, styled } from '@superset-ui/core';
import FiltersConfigModal from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal';
import { getFilterBarTestId } from '../utils';

export interface FCBProps {
  createNewOnOpen?: boolean;
  dashboardId?: number;
  initialFilterId?: string;
  onClick?: () => void;
  children?: ReactNode;
}

const HeaderButton = styled(Button)`
  padding: 0;
`;

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
    async (filterConfig: FilterConfiguration) => {
      dispatch(await setFilterConfiguration(filterConfig));
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
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <HeaderButton
        {...getFilterBarTestId('create-filter')}
        buttonStyle="link"
        buttonSize="xsmall"
        onClick={handleClick}
      >
        {children}
      </HeaderButton>
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
