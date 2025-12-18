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

import { SupersetClient, t } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import {
  Modal,
  AsyncSelect,
  InfoTooltip,
  Input,
  Collapse,
} from '@superset-ui/core/components';
import rison from 'rison';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { DataAccessRuleObject } from './types';
import PermissionsTree from './PermissionsTree';
import type { PermissionsPayload } from './PermissionsTree/types';

const StyledModal = styled(Modal)`
  max-width: 1200px;
  min-width: min-content;
  width: 100%;
  .ant-modal-footer {
    white-space: nowrap;
  }
`;

const StyledSectionContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 2}px;

    label,
    .control-label {
      display: flex;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextLabel};
      align-items: center;
    }

    .info-solid-small {
      vertical-align: middle;
      padding-bottom: ${theme.sizeUnit / 2}px;
    }
  `}
`;

const StyledInputContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    margin: ${theme.sizeUnit}px;
    margin-bottom: ${theme.sizeUnit * 4}px;

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
      margin-left: ${theme.sizeUnit / 2}px;
      color: ${theme.colorErrorText};
    }
  `}
`;

const StyledTextArea = styled(Input.TextArea)`
  resize: vertical;
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  font-family: monospace;
`;

const StyledCollapse = styled(Collapse)`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  background: transparent;

  .ant-collapse-header {
    padding: ${({ theme }) => theme.sizeUnit}px 0 !important;
  }

  .ant-collapse-content-box {
    padding: ${({ theme }) => theme.sizeUnit}px 0 !important;
  }
`;

export interface DataAccessRuleModalProps {
  rule: DataAccessRuleObject | null;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  onAdd?: (rule?: DataAccessRuleObject) => void;
  onHide: () => void;
  show: boolean;
}

const DEFAULT_RULE: DataAccessRuleObject = {
  name: '',
  description: '',
  role_id: 0,
  rule: JSON.stringify(
    {
      allowed: [],
      denied: [],
    },
    null,
    2,
  ),
};

type SelectValue = {
  value: number;
  label: string;
};

function DataAccessRuleModal(props: DataAccessRuleModalProps) {
  const { rule, addDangerToast, addSuccessToast, onHide, show } = props;

  const [currentRule, setCurrentRule] = useState<DataAccessRuleObject>({
    ...DEFAULT_RULE,
  });
  const [selectedRole, setSelectedRole] = useState<SelectValue | null>(null);
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [permissionsPayload, setPermissionsPayload] =
    useState<PermissionsPayload>({ allowed: [], denied: [] });
  const [showAdvanced, setShowAdvanced] = useState<string[]>([]);

  const isEditMode = rule !== null;

  const {
    state: { loading, resource, error: fetchError },
    fetchResource,
    createResource,
    updateResource,
    clearError,
  } = useSingleViewResource<DataAccessRuleObject>(
    'dar',
    t('data access rule'),
    addDangerToast,
  );

  const updateRuleState = (name: string, value: any) => {
    setCurrentRule(currentRuleData => ({
      ...currentRuleData,
      [name]: value,
    }));
  };

  // Validate form
  const validate = useCallback(() => {
    // Check role is selected
    if (!selectedRole?.value) {
      setDisableSave(true);
      return;
    }

    // If advanced mode is open, validate JSON
    if (showAdvanced.includes('advanced')) {
      try {
        const parsed = JSON.parse(currentRule.rule);
        if (typeof parsed !== 'object' || parsed === null) {
          setJsonError(t('Rule must be a JSON object'));
          setDisableSave(true);
          return;
        }
        setJsonError(null);
      } catch {
        setJsonError(t('Invalid JSON'));
        setDisableSave(true);
        return;
      }
    }

    setDisableSave(false);
  }, [currentRule.rule, selectedRole, showAdvanced]);

  // Initialize
  useEffect(() => {
    if (!isEditMode) {
      setCurrentRule({ ...DEFAULT_RULE });
      setSelectedRole(null);
      setPermissionsPayload({ allowed: [], denied: [] });
      setShowAdvanced([]);
    } else if (rule?.id !== null && !loading && !fetchError) {
      fetchResource(rule.id as number);
    }
  }, [rule]);

  useEffect(() => {
    if (resource) {
      const ruleStr =
        typeof resource.rule === 'string'
          ? resource.rule
          : JSON.stringify(resource.rule, null, 2);

      setCurrentRule({
        ...resource,
        id: rule?.id,
        rule: ruleStr,
      });

      // Parse rule into permissions payload
      try {
        const parsed =
          typeof resource.rule === 'string'
            ? JSON.parse(resource.rule)
            : resource.rule;
        setPermissionsPayload({
          allowed: parsed.allowed || [],
          denied: parsed.denied || [],
        });
      } catch {
        setPermissionsPayload({ allowed: [], denied: [] });
      }

      if (resource.role) {
        setSelectedRole({
          value: resource.role.id,
          label: resource.role.name,
        });
      }
    }
  }, [resource]);

  useEffect(() => {
    validate();
  }, [validate]);

  const onRuleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateRuleState('rule', event.target.value);
  };

  const onRoleChange = (value: SelectValue | null) => {
    setSelectedRole(value);
    if (value) {
      updateRuleState('role_id', value.value);
    }
  };

  const onPermissionsChange = useCallback((payload: PermissionsPayload) => {
    setPermissionsPayload(payload);
    // Update JSON representation
    const ruleJson = JSON.stringify(payload, null, 2);
    updateRuleState('rule', ruleJson);
  }, []);

  const onAdvancedChange = (keys: string | string[]) => {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    setShowAdvanced(keyArray);

    // When opening advanced, sync JSON from permissions
    if (keyArray.includes('advanced')) {
      const ruleJson = JSON.stringify(permissionsPayload, null, 2);
      updateRuleState('rule', ruleJson);
    }
    // When closing advanced, sync permissions from JSON
    if (!keyArray.includes('advanced') && showAdvanced.includes('advanced')) {
      try {
        const parsed = JSON.parse(currentRule.rule);
        setPermissionsPayload({
          allowed: parsed.allowed || [],
          denied: parsed.denied || [],
        });
      } catch {
        // Keep existing payload if JSON is invalid
      }
    }
  };

  const hide = () => {
    clearError();
    setCurrentRule({ ...DEFAULT_RULE });
    setSelectedRole(null);
    setJsonError(null);
    setPermissionsPayload({ allowed: [], denied: [] });
    setShowAdvanced([]);
    onHide();
  };

  const onSave = () => {
    const data = {
      name: currentRule.name || null,
      description: currentRule.description || null,
      role_id: selectedRole?.value,
      rule: currentRule.rule,
    };

    if (isEditMode && currentRule.id) {
      updateResource(currentRule.id, data).then(response => {
        if (!response) {
          return;
        }
        addSuccessToast(t('Rule updated'));
        hide();
      });
    } else {
      createResource(data).then(response => {
        if (!response) return;
        addSuccessToast(t('Rule added'));
        hide();
      });
    }
  };

  const loadRoleOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/dar/related/role?q=${query}`,
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
      width="50%"
      maxWidth="800px"
      title={
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={isEditMode ? t('Edit Data Access Rule') : t('Add Data Access Rule')}
          data-test="dar-modal-title"
        />
      }
    >
      <StyledSectionContainer>
        <div className="main-section">
          <StyledInputContainer>
            <div className="control-label">
              {t('Role')} <span className="required">*</span>
              <InfoTooltip
                tooltip={t(
                  'Select the role this rule applies to. Each role can have multiple data access rules.',
                )}
              />
            </div>
            <div className="input-container">
              <AsyncSelect
                ariaLabel={t('Role')}
                onChange={onRoleChange}
                value={selectedRole}
                options={loadRoleOptions}
                data-test="role-select"
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {t('Name')}
              <InfoTooltip
                tooltip={t('Optional name to help identify this rule.')}
              />
            </div>
            <div className="input-container">
              <Input
                name="name"
                value={currentRule.name || ''}
                onChange={e => updateRuleState('name', e.target.value)}
                placeholder={t('e.g., Sales team access')}
                data-test="rule-name"
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {t('Description')}
              <InfoTooltip
                tooltip={t('Optional description of what this rule grants or restricts.')}
              />
            </div>
            <div className="input-container">
              <Input.TextArea
                name="description"
                value={currentRule.description || ''}
                onChange={e => updateRuleState('description', e.target.value)}
                placeholder={t('Describe the purpose of this rule...')}
                rows={2}
                data-test="rule-description"
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {t('Table Permissions')}
              <InfoTooltip
                tooltip={t(
                  'Select databases, schemas, and tables to allow or deny access. Click the icons to toggle between Allow (green), Deny (red), and Inherit (gray).',
                )}
              />
            </div>
            <PermissionsTree
              value={permissionsPayload}
              onChange={onPermissionsChange}
            />
          </StyledInputContainer>

          <StyledCollapse
            activeKey={showAdvanced}
            onChange={onAdvancedChange}
            ghost
            items={[
              {
                key: 'advanced',
                label: t('Advanced: Edit JSON directly'),
                children: (
                  <>
                    <StyledInputContainer>
                      <div className="control-label">
                        {t('Rule (JSON)')}
                        <InfoTooltip
                          tooltip={t(
                            `Define the access rule as a JSON document with "allowed" and "denied" arrays. Each entry specifies database, catalog, schema, table, and optional RLS/CLS configurations.`,
                          )}
                        />
                      </div>
                      <div className="input-container">
                        <StyledTextArea
                          rows={15}
                          name="rule"
                          value={currentRule.rule}
                          onChange={onRuleChange}
                          status={jsonError ? 'error' : undefined}
                          data-test="rule-json"
                        />
                      </div>
                      {jsonError && (
                        <div style={{ color: 'red', marginTop: '4px' }}>
                          {jsonError}
                        </div>
                      )}
                    </StyledInputContainer>

                  </>
                ),
              },
            ]}
          />
        </div>
      </StyledSectionContainer>
    </StyledModal>
  );
}

export default DataAccessRuleModal;
