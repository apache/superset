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
import { t, styled } from '@superset-ui/core';
import React, { FC } from 'react';
import Button from 'src/components/Button';
import { Tooltip } from 'src/common/components/Tooltip';

type FooterProps = {
  isApplyDisabled: boolean;
  disabled: boolean;
  editMode: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onCreate: () => void;
};

const ActionButton = styled.div<{ disabled: boolean }>`
  display: flex;
  padding: 1px;
  & button {
    ${({ disabled }) => `pointer-events: ${disabled ? 'none' : 'all'}`};
    flex: 1;
  }
`;

const ActionButtons = styled.div`
  display: grid;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  grid-gap: 10px;
  grid-template-columns: 1fr 1fr;
`;

const APPLY_FILTERS = t('Please apply filter changes');

const Footer: FC<FooterProps> = ({
  onCancel,
  editMode,
  onEdit,
  onCreate,
  disabled,
  isApplyDisabled,
}) => (
  <>
    {editMode ? (
      <ActionButtons>
        <Button
          buttonStyle="tertiary"
          buttonSize="small"
          onClick={onCancel}
          data-test="filter-set-cancel-button"
        >
          {t('Cancel')}
        </Button>
        <Tooltip
          placement="bottom"
          title={
            (isApplyDisabled && t('Please filter set name')) ||
            (disabled && APPLY_FILTERS)
          }
        >
          <ActionButton disabled={disabled}>
            <Button
              disabled={isApplyDisabled || disabled}
              buttonStyle="primary"
              htmlType="submit"
              buttonSize="small"
              onClick={onCreate}
              data-test="filter-set-create-button"
            >
              {t('Create')}
            </Button>
          </ActionButton>
        </Tooltip>
      </ActionButtons>
    ) : (
      <Tooltip placement="bottom" title={disabled && APPLY_FILTERS}>
        <ActionButton disabled={disabled}>
          <Button
            disabled={disabled}
            buttonStyle="tertiary"
            buttonSize="small"
            data-test="filter-set-create-new-button"
            onClick={onEdit}
          >
            {t('Create new filter set')}
          </Button>
        </ActionButton>
      </Tooltip>
    )}
  </>
);

export default Footer;
