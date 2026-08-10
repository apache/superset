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

import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';
import { useEffect, useMemo, useState } from 'react';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import {
  Modal,
  Select,
  AsyncSelect,
  InfoTooltip,
  LabeledErrorBoundInput,
  Input,
} from '@superset-ui/core/components';
import rison from 'rison';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import SubjectPicker, {
  mapSubjectPickerValuesToIds,
  normalizeSubjectsToPickerValues,
  type SubjectPickerValue,
} from 'src/features/subjects/SubjectPicker';
import { FILTER_OPTIONS } from './constants';
import { FilterType, RLSObject, TableObject } from './types';

const noMargins = css`
  margin: 0;

  .ant-input {
    margin: 0;
  }
`;

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
  resize: none;
  margin-top: ${({ theme }) => theme.sizeUnit}px;
`;

export interface RowLevelSecurityModalProps {
  rule: RLSObject | null;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  onAdd?: (alert?: any) => void;
  onHide: () => void;
  show: boolean;
}

type TableSelectValue = {
  value: number;
  label: string;
};

type RLSFormState = Omit<RLSObject, 'tables' | 'subjects'> & {
  tables: TableSelectValue[];
  subjects: SubjectPickerValue[];
};

type RLSRequestPayload = Omit<RLSObject, 'id' | 'tables' | 'subjects'> & {
  tables: number[];
  subjects: number[];
};

type TextFieldName = 'name' | 'group_key' | 'clause' | 'description';

const TEXT_FIELD_NAMES = new Set<string>([
  'name',
  'group_key',
  'clause',
  'description',
]);

const isTextFieldName = (name: string): name is TextFieldName =>
  TEXT_FIELD_NAMES.has(name);

const createDefaultRule = (): RLSFormState => ({
  name: '',
  filter_type: FilterType.Regular,
  tables: [],
  subjects: [],
  clause: '',
  group_key: '',
  description: '',
});

const mapTablesToSelectValues = (
  tables: TableObject[] = [],
): TableSelectValue[] =>
  tables.flatMap(table => {
    if (table.id === undefined) {
      return [];
    }
    return {
      value: table.id,
      label:
        table.schema && table.table_name
          ? `${table.schema}.${table.table_name}`
          : table.table_name || String(table.id),
    };
  });

const mapRuleToFormState = (
  resource: RLSObject,
  id: number | undefined,
): RLSFormState => {
  const defaultRule = createDefaultRule();
  return {
    ...defaultRule,
    ...resource,
    id,
    tables: mapTablesToSelectValues(resource.tables),
    subjects: normalizeSubjectsToPickerValues(resource.subjects || []),
  };
};

const mapFormStateToPayload = (
  currentRule: RLSFormState,
): RLSRequestPayload => {
  const {
    id: _id,
    tables: selectedTables,
    subjects: selectedSubjects,
    ...values
  } = currentRule;

  return {
    ...values,
    tables: selectedTables.map(table => table.value),
    subjects: mapSubjectPickerValuesToIds(selectedSubjects),
  };
};

function RowLevelSecurityModal(props: RowLevelSecurityModalProps) {
  const { rule, addDangerToast, addSuccessToast, onHide, show } = props;

  const [currentRule, setCurrentRule] =
    useState<RLSFormState>(createDefaultRule);
  const [disableSave, setDisableSave] = useState<boolean>(true);

  const isEditMode = rule !== null;

  // * hooks *
  const {
    state: { loading, resource, error: fetchError },
    fetchResource,
    createResource,
    updateResource,
    clearError,
  } = useSingleViewResource<RLSObject, RLSRequestPayload>(
    `rowlevelsecurity`,
    t('rowlevelsecurity'),
    addDangerToast,
  );

  const updateRuleState = <Key extends keyof RLSFormState>(
    name: Key,
    value: RLSFormState[Key],
  ) => {
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

  // initialize
  useEffect(() => {
    if (!isEditMode) {
      setCurrentRule(createDefaultRule());
    } else if (rule?.id !== undefined && !loading && !fetchError) {
      fetchResource(rule.id);
    }
  }, [rule]);

  useEffect(() => {
    if (resource) {
      setCurrentRule(mapRuleToFormState(resource, rule?.id ?? resource.id));
    }
  }, [resource]);

  // validate
  useEffect(() => {
    validate();
  }, [currentRule.name, currentRule.clause, currentRule.tables]);

  // * event handlers *
  const onTextChange = (target: HTMLInputElement | HTMLTextAreaElement) => {
    if (isTextFieldName(target.name)) {
      updateRuleState(target.name, target.value);
    }
  };

  const onFilterChange = (type: string) => {
    updateRuleState('filter_type', type as FilterType);
  };

  const onTablesChange = (tables: TableSelectValue[]) => {
    updateRuleState('tables', tables || []);
  };

  const onSubjectsChange = (subjects: SubjectPickerValue[]) => {
    updateRuleState('subjects', subjects || []);
  };

  const hide = () => {
    clearError();
    setCurrentRule(createDefaultRule());
    onHide();
  };

  const onSave = () => {
    const data = mapFormStateToPayload(currentRule);

    if (isEditMode && currentRule.id) {
      updateResource(currentRule.id, data).then(response => {
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
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={isEditMode ? t('Edit Rule') : t('Add Rule')}
          data-test="rls-modal-title"
        />
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
                  'Regular filters add where clauses to queries if a user matches a subject referenced in the filter. Base filters apply filters to all queries except the subjects defined in the filter, and can be used to define what users can see if no RLS filters within a filter group apply to them.',
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
                value={currentRule.tables}
                options={loadTableOptions}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {currentRule.filter_type === FilterType.Base
                ? t('Excluded subjects')
                : t('Subjects')}{' '}
              <InfoTooltip
                tooltip={t(
                  'For regular filters, these are the subjects (users, roles, groups) this filter will be applied to. For base filters, these are the subjects that the filter DOES NOT apply to, e.g. Admin if admin should see all data.',
                )}
              />
            </div>
            <div className="input-container">
              <SubjectPicker
                relatedUrl="/api/v1/rowlevelsecurity/related/subjects"
                ariaLabel={t('Subjects')}
                onChange={onSubjectsChange}
                value={currentRule?.subjects || []}
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
