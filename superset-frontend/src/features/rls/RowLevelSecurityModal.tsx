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
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icons from 'src/components/Icons';
import Select from 'src/components/Select/Select';
import { TextArea } from 'src/components/Input';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import rison from 'rison';
import { LabeledErrorBoundInput } from 'src/components/Form';
import InfoTooltip from 'src/components/InfoTooltip';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { FILTER_OPTIONS } from './constants';
import { FilterType, RLSObject, RoleObject, TableObject } from './types';

const noMargins = css`
  margin: 0;

  .antd5-input {
    margin: 0;
  }
`;

const StyledModal = styled(Modal)`
  max-width: 1200px;
  min-width: min-content;
  width: 100%;
  .antd5-modal-footer {
    white-space: nowrap;
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

  label,
  .control-label {
    display: inline-block;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    vertical-align: middle;
  }

  .info-solid-small {
    vertical-align: middle;
    padding-bottom: ${({ theme }) => theme.gridUnit / 2}px;
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
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const StyledTextArea = styled(TextArea)`
  resize: none;
  margin-top: ${({ theme }) => theme.gridUnit}px;
`;

export interface RowLevelSecurityModalProps {
  rule: RLSObject | null;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  onAdd?: (alert?: any) => void;
  onHide: () => void;
  show: boolean;
}

const DEFAULT_RULE = {
  name: '',
  filter_type: FilterType.Regular,
  tables: [],
  roles: [],
  clause: '',
  group_key: '',
  description: '',
};

function RowLevelSecurityModal(props: RowLevelSecurityModalProps) {
  const { rule, addDangerToast, addSuccessToast, onHide, show } = props;

  const [currentRule, setCurrentRule] = useState<RLSObject>({
    ...DEFAULT_RULE,
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

  const updateRuleState = (name: string, value: any) => {
    setCurrentRule(currentRuleData => ({
      ...currentRuleData,
      [name]: value,
    }));
  };

  // * state validators *
  const validate = () => {
    if (
      currentRule?.name &&
      currentRule?.clause &&
      currentRule.tables?.length
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // find selected tables and roles
  const getSelectedData = useCallback(() => {
    if (!resource) {
      return null;
    }
    const tables: TableObject[] = [];
    const roles: RoleObject[] = [];

    resource.tables?.forEach(selectedTable => {
      tables.push({
        key: selectedTable.id,
        label: selectedTable.schema
          ? `${selectedTable.schema}.${selectedTable.table_name}`
          : selectedTable.table_name,
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

  // initialize
  useEffect(() => {
    if (!isEditMode) {
      setCurrentRule({ ...DEFAULT_RULE });
    } else if (rule?.id !== null && !loading && !fetchError) {
      fetchResource(rule.id as number);
    }
  }, [rule]);

  useEffect(() => {
    if (resource) {
      setCurrentRule({ ...resource, id: rule?.id });
      const selectedTableAndRoles = getSelectedData();
      updateRuleState('tables', selectedTableAndRoles?.tables || []);
      updateRuleState('roles', selectedTableAndRoles?.roles || []);
    }
  }, [resource]);

  // validate
  const currentRuleSafe = currentRule || {};
  useEffect(() => {
    validate();
  }, [currentRuleSafe.name, currentRuleSafe.clause, currentRuleSafe?.tables]);

  // * event handlers *
  type SelectValue = {
    value: string;
    label: string;
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
    setCurrentRule({ ...DEFAULT_RULE });
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
              css={noMargins}
              label={t('Rule Name')}
              data-test="rule-name-test"
              tooltipText={t('The name of the rule must be unique')}
              hasTooltip
            />
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {t('Filter Type')}{' '}
              <InfoTooltip
                tooltip={t(
                  'Regular filters add where clauses to queries if a user belongs to a role referenced in the filter, base filters apply filters to all queries except the roles defined in the filter, and can be used to define what users can see if no RLS filters within a filter group apply to them.',
                )}
              />
            </div>
            <div className="input-container">
              <Select
                name="filter_type"
                ariaLabel={t('Filter Type')}
                placeholder={t('Filter Type')}
                onChange={onFilterChange}
                value={currentRule?.filter_type}
                options={FILTER_OPTIONS}
                data-test="rule-filter-type-test"
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {t('Datasets')} <span className="required">*</span>
              <InfoTooltip
                tooltip={t(
                  'These are the datasets this filter will be applied to.',
                )}
              />
            </div>
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
            <div className="control-label">
              {currentRule.filter_type === FilterType.Base
                ? t('Excluded roles')
                : t('Roles')}{' '}
              <InfoTooltip
                tooltip={t(
                  'For regular filters, these are the roles this filter will be applied to. For base filters, these are the roles that the filter DOES NOT apply to, e.g. Admin if admin should see all data.',
                )}
              />
            </div>
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
              css={noMargins}
              label={t('Group Key')}
              hasTooltip
              tooltipText={t(
                `Filters with the same group key will be ORed together within the group, while different filter groups will be ANDed together. Undefined group keys are treated as unique groups, i.e. are not grouped together. For example, if a table has three filters, of which two are for departments Finance and Marketing (group key = 'department'), and one refers to the region Europe (group key = 'region'), the filter clause would apply the filter (department = 'Finance' OR department = 'Marketing') AND (region = 'Europe').`,
              )}
              data-test="group-key-test"
            />
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              <LabeledErrorBoundInput
                id="clause"
                name="clause"
                value={currentRule ? currentRule.clause : ''}
                required
                validationMethods={{
                  onChange: ({ target }: { target: HTMLInputElement }) =>
                    onTextChange(target),
                }}
                css={noMargins}
                label={t('Clause')}
                hasTooltip
                tooltipText={t(
                  'This is the condition that will be added to the WHERE clause. For example, to only return rows for a particular client, you might define a regular filter with the clause `client_id = 9`. To display no rows unless a user belongs to a RLS filter role, a base filter can be created with the clause `1 = 0` (always false).',
                )}
                data-test="clause-test"
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">{t('Description')}</div>
            <div className="input-container">
              <StyledTextArea
                rows={4}
                name="description"
                value={currentRule ? currentRule.description : ''}
                onChange={event => onTextChange(event.target)}
                data-test="description-test"
              />
            </div>
          </StyledInputContainer>
        </div>
      </StyledSectionContainer>
    </StyledModal>
  );
}

export default RowLevelSecurityModal;
