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
import { FilterType, MetaObject, RLSObject } from './types';
import { validate } from 'schema-utils';
import Select from 'src/components/Select/Select';
import { FilterOptions } from './constants';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { SelectValue } from 'src/filters/components/Select/types';
import rison from 'rison';
import { useSingleViewResource } from '../hooks';
import { hide } from 'yargs';

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
`;

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

interface RowLevelSecurityModalProps {
  rule: RLSObject;
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
  const [tableOptions, setTableOptions] = useState<MetaObject[]>([]);
  const [roleOptions, setRoleOptions] = useState<MetaObject[]>([]);

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
      setCurrentRule({ ...rule });
    }
  }, [rule]);

  // find selected tables and roles
  const getSelectedData = useCallback(() => {
    if (
      !currentRule ||
      (currentRule.tables?.length && currentRule.roles?.length)
    )
      return;
    const tables: MetaObject[] = [];
    const roles: MetaObject[] = [];

    currentRule.tables?.forEach(selectedTable => {
      const table = tableOptions.filter(to => to.value == selectedTable);
      tables.push(table);
    });

    currentRule.roles?.forEach(selectedRole => {
      const role = roleOptions.filter(ro => ro.value == selectedRole);
      roles.push(role);
    });

    return { tables, roles };
  }, [tableOptions, roleOptions, currentRule?.tables, currentRule?.roles]);

  // useEffect()

  // validate
  const currentRuleSafe = currentRule || {};
  useEffect(() => {
    validate();
  }, [
    currentRuleSafe.name,
    currentRuleSafe.filter_type,
    currentRuleSafe.group_key,
    currentRuleSafe.roles,
    currentRuleSafe.tables,
    currentRuleSafe.clause,
  ]);

  // * event handlers *
  const updateRuleState = (name: string, value: any) => {
    console.log('updating rule ', name, value);
    setCurrentRule(currentRuleData => ({
      ...currentRuleData,
      [name]: value,
    }));
  };

  const onTextChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { target } = event;
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
    onHide();
    setCurrentRule({ ...DEAFULT_RULE });
  };

  const onSave = () => {
    const tables: number[] = [];
    const roles: number[] = [];

    currentRule.tables?.forEach(table => tables.push(table.value));
    currentRule.roles?.forEach(role => roles.push(role.value));

    const data = { ...currentRule, tables, roles };

    if (isEditMode && currentRule.id) {
      const updateId = currentRule.id;
      delete currentRule.id;
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
    if (currentRule && currentRule.name && currentRule.clause) {
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
      onHide={onHide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      width="60%"
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
            <div className="control-label">
              {t('Rule Name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={currentRule ? currentRule.name : ''}
                onChange={onTextChange}
              />
            </div>
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
                value={currentRule?.tables}
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
                value={currentRule?.roles}
                options={loadRoleOptions}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">{t('Group Key')}</div>
            <div className="input-container">
              <input
                type="text"
                name="group_key"
                value={currentRule ? currentRule.group_key : ''}
                onChange={onTextChange}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {t('Clause')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="clause"
                value={currentRule ? currentRule.clause : ''}
                onChange={onTextChange}
              />
            </div>
          </StyledInputContainer>

          <StyledInputContainer>
            <div className="control-label">
              {t('Description')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="description"
                name="description"
                value={currentRule ? currentRule.description : ''}
                onChange={onTextChange}
              />
            </div>
          </StyledInputContainer>
        </div>
      </StyledSectionContainer>
    </StyledModal>
  );
}

export default RowLevelSecurityModal;
