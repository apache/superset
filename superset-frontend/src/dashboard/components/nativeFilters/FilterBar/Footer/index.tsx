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

import { styled, t } from '@superset-ui/core';
import React, { FC } from 'react';
import Button from 'src/components/Button';
import { DataMaskState, DataMaskStateWithId } from 'src/dataMask/types';

type FooterProps = {
  onApply: () => void;
  onClearAll: () => void;
  getFilterBarTestId: (id: string) => {};
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  isApplyDisabled: boolean;
};

const ActionButtons = styled.div`
  display: flex;
  flex: 1;
  justify-content: flex-end;
  padding: 5px;
`;

const Footer: FC<FooterProps> = ({
  onApply,
  onClearAll,
  getFilterBarTestId,
  isApplyDisabled,
  dataMaskApplied,
  dataMaskSelected,
}) => {
  const isClearAllDisabled = Object.values(dataMaskApplied).every(
    filter =>
      dataMaskSelected[filter.id]?.filterState?.value === null ||
      (!dataMaskSelected[filter.id] && filter.filterState?.value === null),
  );

  return (
    <ActionButtons>
      <Button
        disabled={isClearAllDisabled}
        buttonStyle="tertiary"
        buttonSize="small"
        onClick={onClearAll}
        {...getFilterBarTestId('clear-button')}
      >
        {t('Clear all')}
      </Button>
      <Button
        disabled={isApplyDisabled}
        buttonStyle="primary"
        htmlType="submit"
        buttonSize="small"
        onClick={onApply}
        {...getFilterBarTestId('apply-button')}
      >
        {t('Apply')}
      </Button>
    </ActionButtons>
  );
};

export default Footer;
