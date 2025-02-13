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
/* eslint camelcase: 0 */
import {
  isValidElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ensureIsArray,
  t,
  styled,
  getChartControlPanelRegistry,
  QueryFormData,
  DatasourceType,
  css,
  SupersetTheme,
  useTheme,
  isDefined,
  JsonValue,
  NO_TIME_RANGE,
  usePrevious,
} from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlState,
  CustomControlItem,
  Dataset,
  ExpandedControlItem,
  isCustomControlItem,
  isTemporalColumn,
  sections,
} from '@superset-ui/chart-controls';
import { useSelector } from 'react-redux';
import { rgba } from 'emotion-rgba';
import { kebabCase, isEqual } from 'lodash';

import Collapse from 'src/components/Collapse';
import Tabs from 'src/components/Tabs';
import { PluginContext } from 'src/components/DynamicPlugins';
import Loading from 'src/components/Loading';
import Modal from 'src/components/Modal';

import { getSectionsToRender } from 'src/explore/controlUtils';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import { ChartState, ExplorePageState } from 'src/explore/types';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import ControlRow from './ControlRow';
import Control from './Control';
import { ExploreAlert } from './ExploreAlert';
import { RunQueryButton } from './RunQueryButton';
import { Operators } from '../constants';
import { Clauses } from './controls/FilterControl/types';
import StashFormDataContainer from './StashFormDataContainer';

const { confirm } = Modal;

export type ControlPanelsContainerProps = {
  exploreState: ExplorePageState['explore'];
  actions: ExploreActions;
  datasource_type: DatasourceType;
  chart: ChartState;
  controls: Record<string, ControlState>;
  form_data: QueryFormData;
  isDatasourceMetaLoading: boolean;
  errorMessage: ReactNode;
  onQuery: () => void;
  onStop: () => void;
  canStopQuery: boolean;
  chartIsStale: boolean;
};

export type ExpandedControlPanelSectionConfig = Omit<
  ControlPanelSectionConfig,
  'controlSetRows'
> & {
  controlSetRows: ExpandedControlItem[][];
};

const iconStyles = css`
  &.anticon {
    font-size: unset;
    .anticon {
      line-height: unset;
      vertical-align: unset;
    }
  }
`;

const actionButtonsContainerStyles = (theme: SupersetTheme) => css`
  display: flex;
  position: sticky;
  bottom: 0;
  flex-direction: column;
  align-items: center;
  padding: ${theme.gridUnit * 4}px;
  z-index: 999;
  background: linear-gradient(
    ${rgba(theme.colors.grayscale.light5, 0)},
    ${theme.colors.grayscale.light5} ${theme.opacity.mediumLight}
  );

  & > button {
    min-width: 156px;
  }
`;

const Styles = styled.div`
  position: relative;
  height: 100%;
  width: 100%;

  // Resizable add overflow-y: auto as a style to this div
  // To override it, we need to use !important
  overflow: visible !important;
  #controlSections {
    height: 100%;
    overflow: visible;
  }
  .nav-tabs {
    flex: 0 0 1;
  }
  .tab-content {
    overflow: auto;
    flex: 1 1 100%;
  }
  .Select__menu {
    max-width: 100%;
  }
  .type-label {
    margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    width: ${({ theme }) => theme.gridUnit * 7}px;
    display: inline-block;
    text-align: center;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const ControlPanelsTabs = styled(Tabs)`
  ${({ theme, fullWidth }) => css`
    height: 100%;
    overflow: visible;
    .ant-tabs-nav {
      margin-bottom: 0;
    }
    .ant-tabs-nav-list {
      width: ${fullWidth ? '100%' : '50%'};
    }
    .ant-tabs-tabpane {
      height: 100%;
    }
    .ant-tabs-content-holder {
      padding-top: ${theme.gridUnit * 4}px;
    }

    .ant-collapse-ghost > .ant-collapse-item {
      &:not(:last-child) {
        border-bottom: 1px solid ${theme.colors.grayscale.light3};
      }

      & > .ant-collapse-header {
        font-size: ${theme.typography.sizes.s}px;
      }

      & > .ant-collapse-content > .ant-collapse-content-box {
        padding-bottom: 0;
        font-size: ${theme.typography.sizes.s}px;
      }
    }
  `}
`;

const isTimeSection = (section: ControlPanelSectionConfig): boolean =>
  !!section.label && sections.legacyTimeseriesTime.label === section.label;

const hasTimeColumn = (datasource: Dataset): boolean =>
  datasource?.columns?.some(c => c.is_dttm);
const sectionsToExpand = (
  sections: ControlPanelSectionConfig[],
  datasource: Dataset,
): string[] =>
  // avoid expanding time section if datasource doesn't include time column
  sections.reduce(
    (acc, section) =>
      (section.expanded || !section.label) &&
      (!isTimeSection(section) || hasTimeColumn(datasource))
        ? [...acc, String(section.label)]
        : acc,
    [] as string[],
  );

function getState(
  vizType: string,
  datasource: Dataset,
  datasourceType: DatasourceType,
) {
  const querySections: ControlPanelSectionConfig[] = [];
  const customizeSections: ControlPanelSectionConfig[] = [];

  getSectionsToRender(vizType, datasourceType).forEach(section => {
    // if at least one control in the section is not `renderTrigger`
    // or asks to be displayed at the Data tab
    if (
      section.tabOverride === 'data' ||
      section.controlSetRows.some(rows =>
        rows.some(
          control =>
            control &&
            typeof control === 'object' &&
            'config' in control &&
            control.config &&
            (!control.config.renderTrigger ||
              control.config.tabOverride === 'data'),
        ),
      )
    ) {
      querySections.push(section);
    } else if (section.controlSetRows.length > 0) {
      customizeSections.push(section);
    }
  });
  const expandedQuerySections: string[] = sectionsToExpand(
    querySections,
    datasource,
  );
  const expandedCustomizeSections: string[] = sectionsToExpand(
    customizeSections,
    datasource,
  );
  return {
    expandedQuerySections,
    expandedCustomizeSections,
    querySections,
    customizeSections,
  };
}

function useResetOnChangeRef(initialValue: () => any, resetOnChangeValue: any) {
  const value = useRef(initialValue());
  const prevResetOnChangeValue = useRef(resetOnChangeValue);
  if (prevResetOnChangeValue.current !== resetOnChangeValue) {
    value.current = initialValue();
    prevResetOnChangeValue.current = resetOnChangeValue;
  }

  return value;
}

export const ControlPanelsContainer = (props: ControlPanelsContainerProps) => {
  const { colors } = useTheme();
  const pluginContext = useContext(PluginContext);

  const prevState = usePrevious(props.exploreState);
  const prevDatasource = usePrevious(props.exploreState.datasource);
  const prevChartStatus = usePrevious(props.chart.chartStatus);

  const [showDatasourceAlert, setShowDatasourceAlert] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const controlsTransferred = useSelector<
    ExplorePageState,
    string[] | undefined
  >(state => state.explore.controlsTransferred);

  const defaultTimeFilter = useSelector<ExplorePageState>(
    state => state.common?.conf?.DEFAULT_TIME_FILTER || NO_TIME_RANGE,
  );

  const { form_data, actions } = props;
  const { setControlValue } = actions;
  const { x_axis, adhoc_filters } = form_data;

  const previousXAxis = usePrevious(x_axis);

  useEffect(() => {
    if (
      x_axis &&
      x_axis !== previousXAxis &&
      isTemporalColumn(x_axis, props.exploreState.datasource)
    ) {
      const noFilter = !adhoc_filters?.find(
        filter =>
          filter.expressionType === 'SIMPLE' &&
          filter.operator === Operators.TemporalRange &&
          filter.subject === x_axis,
      );
      if (noFilter) {
        confirm({
          title: t('The X-axis is not on the filters list'),
          content:
            t(`The X-axis is not on the filters list which will prevent it from being used in
            time range filters in dashboards. Would you like to add it to the filters list?`),
          onOk: () => {
            setControlValue('adhoc_filters', [
              ...(adhoc_filters || []),
              {
                clause: Clauses.Where,
                subject: x_axis,
                operator: Operators.TemporalRange,
                comparator: defaultTimeFilter,
                expressionType: 'SIMPLE',
              },
            ]);
          },
        });
      }
    }
  }, [
    x_axis,
    adhoc_filters,
    setControlValue,
    defaultTimeFilter,
    previousXAxis,
    props.exploreState.datasource,
  ]);

  useEffect(() => {
    let shouldUpdateControls = false;
    const removeDatasourceWarningFromControl = (
      value: JsonValue | undefined,
    ) => {
      if (
        typeof value === 'object' &&
        isDefined(value) &&
        'datasourceWarning' in value &&
        value.datasourceWarning === true
      ) {
        shouldUpdateControls = true;
        return { ...value, datasourceWarning: false };
      }
      return value;
    };
    if (
      props.chart.chartStatus === 'success' &&
      prevChartStatus !== 'success'
    ) {
      controlsTransferred?.forEach(controlName => {
        shouldUpdateControls = false;
        if (!isDefined(props.controls[controlName])) {
          return;
        }
        const alteredControls = Array.isArray(props.controls[controlName].value)
          ? ensureIsArray(props.controls[controlName].value)?.map(
              removeDatasourceWarningFromControl,
            )
          : removeDatasourceWarningFromControl(
              props.controls[controlName].value,
            );
        if (shouldUpdateControls) {
          props.actions.setControlValue(controlName, alteredControls);
        }
      });
    }
  }, [
    controlsTransferred,
    prevChartStatus,
    props.actions,
    props.chart.chartStatus,
    props.controls,
  ]);

  useEffect(() => {
    if (
      prevDatasource &&
      prevDatasource.type !== DatasourceType.Query &&
      (props.exploreState.datasource?.id !== prevDatasource.id ||
        props.exploreState.datasource?.type !== prevDatasource.type)
    ) {
      setShowDatasourceAlert(true);
      containerRef.current?.scrollTo(0, 0);
    }
  }, [
    props.exploreState.datasource?.id,
    props.exploreState.datasource?.type,
    prevDatasource,
  ]);

  const {
    expandedQuerySections,
    expandedCustomizeSections,
    querySections,
    customizeSections,
  } = useMemo(
    () =>
      getState(
        form_data.viz_type,
        props.exploreState.datasource,
        props.datasource_type,
      ),
    [props.exploreState.datasource, form_data.viz_type, props.datasource_type],
  );

  const resetTransferredControls = useCallback(() => {
    ensureIsArray(props.exploreState.controlsTransferred).forEach(controlName =>
      props.actions.setControlValue(
        controlName,
        props.controls[controlName].default,
      ),
    );
  }, [props.actions, props.exploreState.controlsTransferred, props.controls]);

  const handleClearFormClick = useCallback(() => {
    resetTransferredControls();
    setShowDatasourceAlert(false);
  }, [resetTransferredControls]);

  const handleContinueClick = useCallback(() => {
    setShowDatasourceAlert(false);
  }, []);

  const shouldRecalculateControlState = ({
    name,
    config,
  }: CustomControlItem): boolean => {
    const { controls, chart, exploreState } = props;

    return Boolean(
      config.shouldMapStateToProps?.(
        prevState || exploreState,
        exploreState,
        controls[name],
        chart,
      ),
    );
  };

  const renderControl = ({ name, config }: CustomControlItem) => {
    const { controls, chart, exploreState } = props;
    const { visibility, hidden, disableStash, ...restConfig } = config;

    // If the control item is not an object, we have to look up the control data from
    // the centralized controls file.
    // When it is an object we read control data straight from `config` instead
    const controlData = {
      ...restConfig,
      ...controls[name],
      ...(shouldRecalculateControlState({ name, config })
        ? config?.mapStateToProps?.(exploreState, controls[name], chart)
        : // for other controls, `mapStateToProps` is already run in
          // controlUtils/getControlState.ts
          undefined),
      name,
    };
    const {
      validationErrors,
      label: baseLabel,
      description: baseDescription,
      ...restProps
    } = controlData as ControlState & {
      validationErrors?: any[];
    };

    const isVisible = visibility
      ? visibility.call(config, props, controlData)
      : undefined;

    const isHidden =
      typeof hidden === 'function'
        ? hidden.call(config, props, controlData)
        : hidden;

    const label =
      typeof baseLabel === 'function'
        ? baseLabel(exploreState, controls[name], chart)
        : baseLabel;

    const description =
      typeof baseDescription === 'function'
        ? baseDescription(exploreState, controls[name], chart)
        : baseDescription;

    if (name.includes('adhoc_filters')) {
      restProps.canDelete = (
        valueToBeDeleted: Record<string, any>,
        values: Record<string, any>[],
      ) => {
        const isTemporalRange = (filter: Record<string, any>) =>
          filter.operator === Operators.TemporalRange;
        if (!controls?.time_range?.value && isTemporalRange(valueToBeDeleted)) {
          const count = values.filter(isTemporalRange).length;
          if (count === 1) {
            // if temporal filter's value is "No filter", prevent deletion
            // otherwise reset the value to "No filter"
            if (valueToBeDeleted.comparator === defaultTimeFilter) {
              return t(
                `You cannot delete the last temporal filter as it's used for time range filters in dashboards.`,
              );
            }
            props.actions.setControlValue(
              name,
              values.map(val => {
                if (isEqual(val, valueToBeDeleted)) {
                  return {
                    ...val,
                    comparator: defaultTimeFilter,
                  };
                }
                return val;
              }),
            );
            return false;
          }
        }
        return true;
      };
    }

    return (
      <StashFormDataContainer
        shouldStash={isVisible === false && disableStash !== true}
        fieldNames={[name]}
        key={`control-container-${name}`}
      >
        <Control
          key={`control-${name}`}
          name={name}
          label={label}
          description={description}
          validationErrors={validationErrors}
          actions={props.actions}
          isVisible={isVisible}
          hidden={isHidden}
          {...restProps}
        />
      </StashFormDataContainer>
    );
  };

  const sectionHasHadNoErrors = useResetOnChangeRef(
    () => ({}),
    form_data.viz_type,
  );

  const renderControlPanelSection = (
    section: ExpandedControlPanelSectionConfig,
  ) => {
    const { controls } = props;
    const { label, description, visibility } = section;

    // Section label can be a ReactNode but in some places we want to
    // have a string ID. Using forced type conversion for now,
    // should probably add a `id` field to sections in the future.
    const sectionId = String(label);
    const isVisible = visibility?.call(this, props, controls) !== false;
    const hasErrors = section.controlSetRows.some(rows =>
      rows.some(item => {
        const controlName =
          typeof item === 'string'
            ? item
            : item && 'name' in item
              ? item.name
              : null;
        return (
          controlName &&
          controlName in controls &&
          controls[controlName].validationErrors &&
          controls[controlName].validationErrors.length > 0
        );
      }),
    );

    if (!hasErrors) {
      sectionHasHadNoErrors.current[sectionId] = true;
    }

    const errorColor = sectionHasHadNoErrors.current[sectionId]
      ? colors.error.base
      : colors.warning.base;

    const PanelHeader = () => (
      <span data-test="collapsible-control-panel-header">
        <span
          css={(theme: SupersetTheme) => css`
            font-size: ${theme.typography.sizes.m}px;
            line-height: 1.3;
            font-weight: ${theme.typography.weights.medium};
          `}
        >
          {label}
        </span>{' '}
        {description && (
          <Tooltip id={sectionId} title={description}>
            <Icons.InfoCircleOutlined css={iconStyles} />
          </Tooltip>
        )}
        {hasErrors && (
          <Tooltip
            id={`${kebabCase('validation-errors')}-tooltip`}
            title={t('This section contains validation errors')}
          >
            <Icons.InfoCircleOutlined
              css={css`
                ${iconStyles};
                color: ${errorColor};
              `}
            />
          </Tooltip>
        )}
      </span>
    );

    return (
      <>
        <StashFormDataContainer
          key={`sectionId-${sectionId}`}
          shouldStash={!isVisible}
          fieldNames={section.controlSetRows
            .flat()
            .map(item =>
              item && typeof item === 'object'
                ? 'name' in item
                  ? item.name
                  : ''
                : String(item || ''),
            )
            .filter(Boolean)}
        />
        {isVisible && (
          <Collapse.Panel
            css={theme => css`
              margin-bottom: 0;
              box-shadow: none;

              &:last-child {
                padding-bottom: ${theme.gridUnit * 16}px;
                border-bottom: 0;
              }

              .panel-body {
                margin-left: ${theme.gridUnit * 4}px;
                padding-bottom: 0;
              }

              span.label {
                display: inline-block;
              }
              ${!section.label &&
              `
          .ant-collapse-header {
            display: none;
          }
        `}
            `}
            header={<PanelHeader />}
            key={sectionId}
          >
            {section.controlSetRows.map((controlSets, i) => {
              const renderedControls = controlSets
                .map(controlItem => {
                  if (!controlItem) {
                    // When the item is invalid
                    return null;
                  }
                  if (isValidElement(controlItem)) {
                    // When the item is a React element
                    return controlItem;
                  }
                  if (
                    isCustomControlItem(controlItem) &&
                    controlItem.name !== 'datasource'
                  ) {
                    return renderControl(controlItem);
                  }
                  return null;
                })
                .filter(x => x !== null);
              // don't show the row if it is empty
              if (renderedControls.length === 0) {
                return null;
              }
              return (
                <ControlRow
                  key={`controlsetrow-${i}`}
                  controls={renderedControls}
                />
              );
            })}
          </Collapse.Panel>
        )}
      </>
    );
  };

  const hasControlsTransferred =
    ensureIsArray(props.exploreState.controlsTransferred).length > 0;

  const DatasourceAlert = useCallback(
    () =>
      hasControlsTransferred ? (
        <ExploreAlert
          title={t('Keep control settings?')}
          bodyText={t(
            "You've changed datasets. Any controls with data (columns, metrics) that match this new dataset have been retained.",
          )}
          primaryButtonAction={handleContinueClick}
          secondaryButtonAction={handleClearFormClick}
          primaryButtonText={t('Continue')}
          secondaryButtonText={t('Clear form')}
          type="info"
        />
      ) : (
        <ExploreAlert
          title={t('No form settings were maintained')}
          bodyText={t(
            'We were unable to carry over any controls when switching to this new dataset.',
          )}
          primaryButtonAction={handleContinueClick}
          primaryButtonText={t('Continue')}
          type="warning"
        />
      ),
    [handleClearFormClick, handleContinueClick, hasControlsTransferred],
  );

  const dataTabHasHadNoErrors = useResetOnChangeRef(
    () => false,
    form_data.viz_type,
  );

  const dataTabTitle = useMemo(() => {
    if (!props.errorMessage) {
      dataTabHasHadNoErrors.current = true;
    }

    const errorColor = dataTabHasHadNoErrors.current
      ? colors.error.base
      : colors.warning.base;

    return (
      <>
        <span>{t('Data')}</span>
        {props.errorMessage && (
          <span
            css={(theme: SupersetTheme) => css`
              margin-left: ${theme.gridUnit * 2}px;
            `}
          >
            {' '}
            <Tooltip
              id="query-error-tooltip"
              placement="right"
              title={props.errorMessage}
            >
              <Icons.ExclamationCircleOutlined
                css={css`
                  ${iconStyles};
                  color: ${errorColor};
                `}
              />
            </Tooltip>
          </span>
        )}
      </>
    );
  }, [
    colors.error.base,
    colors.warning.base,
    dataTabHasHadNoErrors,
    props.errorMessage,
  ]);

  const controlPanelRegistry = getChartControlPanelRegistry();
  if (!controlPanelRegistry.has(form_data.viz_type) && pluginContext.loading) {
    return <Loading />;
  }

  const showCustomizeTab = customizeSections.length > 0;

  return (
    <Styles ref={containerRef}>
      <ControlPanelsTabs
        id="controlSections"
        data-test="control-tabs"
        fullWidth={showCustomizeTab}
        allowOverflow={false}
      >
        <Tabs.TabPane key="query" tab={dataTabTitle}>
          <Collapse
            defaultActiveKey={expandedQuerySections}
            expandIconPosition="right"
            ghost
          >
            {showDatasourceAlert && <DatasourceAlert />}
            {querySections.map(renderControlPanelSection)}
          </Collapse>
        </Tabs.TabPane>
        {showCustomizeTab && (
          <Tabs.TabPane key="display" tab={t('Customize')}>
            <Collapse
              defaultActiveKey={expandedCustomizeSections}
              expandIconPosition="right"
              ghost
            >
              {customizeSections.map(renderControlPanelSection)}
            </Collapse>
          </Tabs.TabPane>
        )}
      </ControlPanelsTabs>
      <div css={actionButtonsContainerStyles}>
        <RunQueryButton
          onQuery={props.onQuery}
          onStop={props.onStop}
          errorMessage={props.errorMessage}
          loading={props.chart.chartStatus === 'loading'}
          isNewChart={!props.chart.queriesResponse}
          canStopQuery={props.canStopQuery}
          chartIsStale={props.chartIsStale}
        />
      </div>
    </Styles>
  );
};

export default ControlPanelsContainer;
