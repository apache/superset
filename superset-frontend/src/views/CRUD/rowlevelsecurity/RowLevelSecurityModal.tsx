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

import {
  css,
  styled,
  SupersetClient,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import Modal from 'src/components/Modal';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icons from 'src/components/Icons';
import Select from 'src/components/Select/Select';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import rison from 'rison';
import { LabeledErrorBoundInput } from 'src/components/Form';
import { noBottomMargin } from 'src/components/ReportModal/styles';
import { useSingleViewResource } from '../hooks';
import { FilterOptions } from './constants';
import { FilterType, MetaObject, RLSObject } from './types';

const StyledModal = styled(Modal)`
  max-width: 1200px;
  width: 100%;
  .ant-modal-body {
    overflow: initial;
  }
`;
const StyledIcon = (theme: SupersetTheme) => css`
  margin: auto ${theme.gridUnit * 2}px auto 0;
  color: ${theme.colors.grayscale.base};
`;

const StyledSectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) =>
    `${theme.gridUnit * 3}px ${theme.gridUnit * 4}px ${theme.gridUnit * 2}px`};

  label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
}
`;

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin: ${({ theme }) => theme.gridUnit}px;

  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;

  .input-container {
    display: flex;
    align-items: center;

    > div {
      width: 100%;
    }

    label {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    height: 100px;
    resize: none;
  }

  .labled-input {
    margin-bottom: 0px;
  }
`;

interface RowLevelSecurityModalProps {
  rule: RLSObject | null;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  onAdd?: (alert?: any) => void;
  onHide: () => void;
  show: boolean;
}

const DEAFULT_RULE = {
  name: '',
  filter_type: FilterType.REGULAR,
  tables: [],
  roles: [],
  clause: '',
  group_key: '',
  description: '',
};

function RowLevelSecurityModal(props: RowLevelSecurityModalProps) {
  const { rule, addDangerToast, addSuccessToast, onHide, show } = props;

  const [currentRule, setCurrentRule] = useState<RLSObject>({
    ...DEAFULT_RULE,
  });
  const [disableSave, setDisableSave] = useState<boolean>(true);

  const isEditMode = rule !== null;

  // * hooks *
  const {
    state: { loading, resource, error: fetchError },
    fetchResource,
    createResource,
    updateResource,
    clearError,
  } = useSingleViewResource<RLSObject>(
    `rowlevelsecurity`,
    t('rowlevelsecurity'),
    addDangerToast,
  );

  // initialize
  useEffect(() => {
    if (!isEditMode) {
      setCurrentRule({ ...DEAFULT_RULE });
    } else if (rule?.id !== null && !loading && !fetchError) {
      fetchResource(rule.id as number);
    }
  }, [rule]);

  useEffect(() => {
    console.log('checking resource ', resource);
    if (resource) {
      setCurrentRule({ ...resource, id: rule?.id });
      const selectedTableAndRoles = getSelectedData();
      updateRuleState('tables', selectedTableAndRoles?.tables || []);
      updateRuleState('roles', selectedTableAndRoles?.roles || []);
    }
  }, [resource]);

  // find selected tables and roles
  const getSelectedData = useCallback(() => {
    if (!resource) {
      return null;
    }
    const tables: MetaObject[] = [];
    const roles: MetaObject[] = [];

    resource.tables?.forEach(selectedTable => {
      tables.push({
        key: selectedTable.id,
        label: selectedTable.table_name,
        value: selectedTable.id,
      });
    });

    resource.roles?.forEach(selectedRole => {
      roles.push({
        key: selectedRole.id,
        label: selectedRole.name,
        value: selectedRole.id,
      });
    });

    return { tables, roles };
  }, [resource?.tables, resource?.roles]);

  // validate
  const currentRuleSafe = currentRule || {};
  useEffect(() => {
    validate();
  }, [currentRuleSafe.name, currentRuleSafe.clause]);

  // * event handlers *
  type SelectValue = {
    value: string;
    label: string;
  };

  const updateRuleState = (name: string, value: any) => {
    setCurrentRule(currentRuleData => ({
      ...currentRuleData,
      [name]: value,
    }));
  };

  const onTextChange = (target: HTMLInputElement | HTMLTextAreaElement) => {
    updateRuleState(target.name, target.value);
  };

  const onFilterChange = (type: string) => {
    updateRuleState('filter_type', type);
  };

  const onTablesChange = (tables: Array<SelectValue>) => {
    updateRuleState('tables', tables || []);
  };

  const onRolesChange = (roles: Array<SelectValue>) => {
    updateRuleState('roles', roles || []);
  };

  const hide = () => {
    clearError();
    setCurrentRule({ ...DEAFULT_RULE });
    onHide();
  };

  const onSave = () => {
    const tables: number[] = [];
    const roles: number[] = [];

    currentRule.tables?.forEach(table => tables.push(table.key));
    currentRule.roles?.forEach(role => roles.push(role.key));

    const data: any = { ...currentRule, tables, roles };

    if (isEditMode && currentRule.id) {
      const updateId = currentRule.id;
      delete data.id;
      updateResource(updateId, data).then(response => {
        if (!response) {
          return;
        }
        addSuccessToast(`Rule updated`);
        hide();
      });
    } else if (currentRule) {
      createResource(data).then(response => {
        if (!response) return;
        addSuccessToast(t('Rule added'));
        hide();
      });
    }
  };

  // * data loaders *
  const loadTableOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/rowlevelsecurity/related/tables?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { value: number; text: string }) => ({
              label: item.text,
              value: item.value,
            }),
          );
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

  const loadRoleOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/rowlevelsecurity/related/roles?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { value: number; text: string }) => ({
              label: item.text,
              value: item.value,
            }),
          );
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

  // * state validators *
  const validate = () => {
    if (currentRule?.name && currentRule?.clause) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  return (
    <StyledModal
      className="no-content-padding"
      responsive
      show={show}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      width="30%"
      maxWidth="1450px"
      title={
        <h4 data-test="rls-modal-title">
          {isEditMode ? (
            <Icons.EditAlt css={StyledIcon} />
          ) : (
            <Icons.PlusLarge css={StyledIcon} />
          )}
          {isEditMode ? t('Edit Rule') : t('Add Rule')}
        </h4>
      }
    >
      <StyledSectionContainer>
        <div className="main-section">
          <StyledInputContainer>
            <LabeledErrorBoundInput
              id="name"
              name="name"
              className="labeled-input"
              value={currentRule ? currentRule.name : ''}
              required
              validationMethods={{
                onChange: ({ target }: { target: HTMLInputElement }) =>
                  onTextChange(target),
              }}
              css={noBottomMargin}
              label={t('Rule Name')}
              data-test="rule-name-test"
            />
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">{t('Filter Type')}</div>
            <div className="input-container">
              <Select
                name="filter_type"
                ariaLabel={t('Filter Type')}
                placeholder={t('Filter Type')}
                onChange={onFilterChange}
                value={currentRule?.filter_type}
                options={FilterOptions}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">{t('Tables')}</div>
            <div className="input-container">
              <AsyncSelect
                ariaLabel={t('Tables')}
                mode="multiple"
                onChange={onTablesChange}
                value={(currentRule?.tables as SelectValue[]) || []}
                options={loadTableOptions}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">{t('Roles')}</div>
            <div className="input-container">
              <AsyncSelect
                ariaLabel={t('Roles')}
                mode="multiple"
                onChange={onRolesChange}
                value={(currentRule?.roles as SelectValue[]) || []}
                options={loadRoleOptions}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <LabeledErrorBoundInput
              id="group_key"
              name="group_key"
              value={currentRule ? currentRule.group_key : ''}
              validationMethods={{
                onChange: ({ target }: { target: HTMLInputElement }) =>
                  onTextChange(target),
              }}
              css={noBottomMargin}
              label={t('Group Key')}
              data-test="group-key-test"
            />
          </StyledInputContainer>

          <StyledInputContainer>
            <LabeledErrorBoundInput
              id="clause"
              name="clause"
              value={currentRule ? currentRule.clause : ''}
              required
              validationMethods={{
                onChange: ({ target }: { target: HTMLInputElement }) =>
                  onTextChange(target),
              }}
              css={noBottomMargin}
              label={t('Clause')}
              data-test="clause-test"
            />
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">{t('Description')}</div>
            <div className="input-container">
              <textarea
                name="description"
                value={currentRule ? currentRule.description : ''}
                onChange={event => onTextChange(event.target)}
              />
            </div>
          </StyledInputContainer>
        </div>
      </StyledSectionContainer>
    </StyledModal>
  );
}

export default RowLevelSecurityModal;
