// DODO was here
import {
  CustomControlItem,
  InfoTooltipWithTrigger,
} from '@superset-ui/chart-controls';
import { ReactNode } from 'react';
import { AntdCheckbox, FormInstance } from 'src/components';
import {
  Filter,
  getChartControlPanelRegistry,
  styled,
  t,
} from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { FormItem } from 'src/components/Form';
import {
  doesColumnMatchFilterType,
  getControlItems,
  setNativeFilterFieldValues,
} from './utils';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import {
  StyledFormItem,
  StyledLabel,
  StyledRowFormItem,
} from './FiltersConfigForm';
import { ColumnSelect } from './ColumnSelect';

export interface ControlItemsProps {
  expanded: boolean;
  datasetId: number;
  disabled: boolean;
  forceUpdate: Function;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  filterType: string;
  filterToEdit?: Filter;
  formFilter?: NativeFiltersFormItem;
  removed?: boolean;
}

const CleanFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

export default function getControlItemsMap({
  expanded,
  datasetId,
  disabled,
  forceUpdate,
  form,
  filterId,
  filterType,
  filterToEdit,
  formFilter,
  removed,
}: ControlItemsProps) {
  const controlPanelRegistry = getChartControlPanelRegistry();
  const controlItems =
    getControlItems(controlPanelRegistry.get(filterType)) ?? [];
  const mapControlItems: Record<
    string,
    { element: ReactNode; checked: boolean }
  > = {};
  const mapMainControlItems: Record<
    string,
    { element: ReactNode; checked: boolean }
  > = {};

  controlItems
    .filter(
      (mainControlItem: CustomControlItem) =>
        mainControlItem?.name === 'groupby' ||
        mainControlItem?.name === 'groupbyRu' || // DODO added 44211759
        mainControlItem?.name === 'groupbyid', // DODO added 44211759
    )
    .forEach(mainControlItem => {
      const isGroupby = mainControlItem?.name === 'groupby'; // DODO added 44211759
      const isGroupbyRu = mainControlItem?.name === 'groupbyRu'; // DODO added 44211759
      const initialValue =
        filterToEdit?.controlValues?.[mainControlItem.name] ??
        mainControlItem?.config?.default;
      // const initColumn = filterToEdit?.targets[0]?.column?.name;

      // DODO added start 44211759
      let initColumn: string | undefined;
      let formField: string;
      let label: string;

      if (isGroupbyRu) {
        initColumn = filterToEdit?.targets[0]?.column?.nameRu;
        formField = 'columnRu';
        label = `${t('Column')} RU`;
      } else if (isGroupby) {
        initColumn = filterToEdit?.targets[0]?.column?.name;
        formField = 'column';
        label = `${t('Column')} EN`;
      } else {
        initColumn = filterToEdit?.targets[0]?.column?.id;
        formField = 'columnId';
        label = t('ColumnId');
      }
      // DODO added stop 44211759

      const element = (
        <>
          <CleanFormItem
            name={['filters', filterId, 'requiredFirst', mainControlItem.name]}
            hidden
            initialValue={
              mainControlItem?.config?.requiredFirst &&
              filterToEdit?.requiredFirst
            }
          />
          <StyledFormItem
            expanded={expanded}
            // don't show the column select unless we have a dataset
            // name={['filters', filterId, 'column']}
            name={['filters', filterId, formField]} // DODO changed 44211759
            initialValue={initColumn}
            label={
              <StyledLabel>
                {/* {mainControlItem.config?.label || t('Column')} */}
                {/* DODO changed 44211759 */}
                {mainControlItem.config?.label || label}
              </StyledLabel>
            }
            rules={[
              {
                required: mainControlItem.config?.required && !removed, // TODO: need to move ColumnSelect settings to controlPanel for all filters
                message: t('Column is required'),
              },
            ]}
            data-test="field-input"
          >
            <ColumnSelect
              mode={mainControlItem.config?.multiple && 'multiple'}
              form={form}
              filterId={filterId}
              datasetId={datasetId}
              formField={formField} // DODO added 44211759
              filterValues={column =>
                doesColumnMatchFilterType(formFilter?.filterType || '', column)
              }
              onChange={() => {
                // We need reset default value when column changed
                setNativeFilterFieldValues(form, filterId, {
                  defaultDataMask: null,
                });
                forceUpdate();
              }}
            />
          </StyledFormItem>
        </>
      );
      mapMainControlItems[mainControlItem.name] = {
        element,
        checked: initialValue,
      };
    });
  controlItems
    .filter(
      (controlItem: CustomControlItem) =>
        controlItem?.config?.renderTrigger &&
        controlItem.name !== 'sortAscending' &&
        controlItem.name !== 'enableSingleValue',
    )
    .forEach(controlItem => {
      const initialValue =
        filterToEdit?.controlValues?.[controlItem.name] ??
        controlItem?.config?.default;
      const element = (
        <>
          <CleanFormItem
            name={['filters', filterId, 'requiredFirst', controlItem.name]}
            hidden
            initialValue={
              controlItem?.config?.requiredFirst && filterToEdit?.requiredFirst
            }
          />
          <Tooltip
            key={controlItem.name}
            placement="left"
            title={
              controlItem.config.affectsDataMask &&
              disabled &&
              t('Populate "Default value" to enable this control')
            }
          >
            <StyledRowFormItem
              expanded={expanded}
              key={controlItem.name}
              name={['filters', filterId, 'controlValues', controlItem.name]}
              initialValue={initialValue}
              valuePropName="checked"
              colon={false}
            >
              <AntdCheckbox
                disabled={controlItem.config.affectsDataMask && disabled}
                onChange={({ target: { checked } }) => {
                  if (controlItem.config.requiredFirst) {
                    setNativeFilterFieldValues(form, filterId, {
                      requiredFirst: {
                        ...formFilter?.requiredFirst,
                        [controlItem.name]: checked,
                      },
                    });
                  }
                  if (controlItem.config.resetConfig) {
                    setNativeFilterFieldValues(form, filterId, {
                      defaultDataMask: null,
                    });
                  }
                  forceUpdate();
                }}
              >
                {controlItem.config.label}&nbsp;
                {controlItem.config.description && (
                  <InfoTooltipWithTrigger
                    placement="top"
                    label={controlItem.config.name}
                    tooltip={controlItem.config.description}
                  />
                )}
              </AntdCheckbox>
            </StyledRowFormItem>
          </Tooltip>
        </>
      );
      mapControlItems[controlItem.name] = { element, checked: initialValue };
    });
  return {
    controlItems: mapControlItems,
    mainControlItems: mapMainControlItems,
  };
}
