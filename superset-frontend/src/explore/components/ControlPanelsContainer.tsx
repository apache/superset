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
import React, {
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
} from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlState,
  CustomControlItem,
  Dataset,
  ExpandedControlItem,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { useSelector } from 'react-redux';
import { rgba } from 'emotion-rgba';
import { kebabCase } from 'lodash';

import Collapse from 'src/components/Collapse';
import Tabs from 'src/components/Tabs';
import { PluginContext } from 'src/components/DynamicPlugins';
import Loading from 'src/components/Loading';

import { usePrevious } from 'src/hooks/usePrevious';
import { getSectionsToRender } from 'src/explore/controlUtils';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import { ChartState, ExplorePageState } from 'src/explore/types';
import { Tooltip } from 'src/components/Tooltip';
import Modal from 'src/components/Modal';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import ControlRow from './ControlRow';
import Control from './Control';
import { ExploreAlert } from './ExploreAlert';
import { RunQueryButton } from './RunQueryButton';

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
  !!section.label &&
  (sections.legacyRegularTime.label === section.label ||
    sections.legacyTimeseriesTime.label === section.label);

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
    } else {
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

const DEFAULT_TEMPORAL_COLUMN: keyof typeof sharedControls =
  'default_temporal_column';

export const ControlPanelsContainer = (props: ControlPanelsContainerProps) => {
  const [showXAxisModal, setShowXAxisModal] = useState(false);
  const { colors } = useTheme();
  const pluginContext = useContext(PluginContext);
  const {
    exploreState,
    chart,
    controls,
    actions,
    form_data,
    datasource_type,
    errorMessage,
    onQuery,
    onStop,
    canStopQuery,
    chartIsStale,
  } = props;

  // If the X-axis does not match the default temporal column,
  // ask the user if they wish to apply the X-axis into the
  // default temporal column
  const { x_axis, default_temporal_column } = form_data;
  useEffect(() => {
    if (x_axis && x_axis !== default_temporal_column) {
      setShowXAxisModal(true);
    }
  }, [default_temporal_column, x_axis]);

  const prevState = usePrevious(exploreState);
  const prevDatasource = usePrevious(exploreState.datasource);
  const prevChartStatus = usePrevious(chart.chartStatus);

  const [showDatasourceAlert, setShowDatasourceAlert] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const controlsTransferred = useSelector<
    ExplorePageState,
    string[] | undefined
  >(state => state.explore.controlsTransferred);

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
    if (chart.chartStatus === 'success' && prevChartStatus !== 'success') {
      controlsTransferred?.forEach(controlName => {
        shouldUpdateControls = false;
        if (!isDefined(controls[controlName])) {
          return;
        }
        const alteredControls = Array.isArray(controls[controlName].value)
          ? ensureIsArray(controls[controlName].value)?.map(
              removeDatasourceWarningFromControl,
            )
          : removeDatasourceWarningFromControl(controls[controlName].value);
        if (shouldUpdateControls) {
          actions.setControlValue(controlName, alteredControls);
        }
      });
    }
  }, [
    controlsTransferred,
    prevChartStatus,
    actions,
    chart.chartStatus,
    controls,
  ]);

  useEffect(() => {
    if (
      prevDatasource &&
      prevDatasource.type !== DatasourceType.Query &&
      (exploreState.datasource?.id !== prevDatasource.id ||
        exploreState.datasource?.type !== prevDatasource.type)
    ) {
      setShowDatasourceAlert(true);
      containerRef.current?.scrollTo(0, 0);
    }
  }, [
    exploreState.datasource?.id,
    exploreState.datasource?.type,
    prevDatasource,
  ]);

  const {
    expandedQuerySections,
    expandedCustomizeSections,
    querySections,
    customizeSections,
  } = useMemo(
    () =>
      getState(form_data.viz_type, exploreState.datasource, datasource_type),
    [exploreState.datasource, form_data.viz_type, datasource_type],
  );

  const resetTransferredControls = useCallback(() => {
    ensureIsArray(exploreState.controlsTransferred).forEach(controlName =>
      actions.setControlValue(controlName, controls[controlName].default),
    );
  }, [actions, exploreState.controlsTransferred, controls]);

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
  }: CustomControlItem): boolean =>
    Boolean(
      config.shouldMapStateToProps?.(
        prevState || exploreState,
        exploreState,
        controls[name],
        chart,
      ),
    );

  const renderControl = ({ name, config }: CustomControlItem) => {
    const { visibility } = config;

    // If the control item is not an object, we have to look up the control data from
    // the centralized controls file.
    // When it is an object we read control data straight from `config` instead
    const controlData = {
      ...config,
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

    const label =
      typeof baseLabel === 'function'
        ? baseLabel(exploreState, controls[name], chart)
        : baseLabel;

    const description =
      typeof baseDescription === 'function'
        ? baseDescription(exploreState, controls[name], chart)
        : baseDescription;

    return (
      <Control
        key={`control-${name}`}
        name={name}
        label={label}
        description={description}
        validationErrors={validationErrors}
        actions={actions}
        isVisible={isVisible}
        {...restProps}
      />
    );
  };

  const sectionHasHadNoErrors = useResetOnChangeRef(
    () => ({}),
    form_data.viz_type,
  );

  const renderControlPanelSection = (
    section: ExpandedControlPanelSectionConfig,
  ) => {
    const { label, description } = section;

    // Section label can be a ReactNode but in some places we want to
    // have a string ID. Using forced type conversion for now,
    // should probably add a `id` field to sections in the future.
    const sectionId = String(label);

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
      : colors.alert.base;

    const PanelHeader = () => (
      <span data-test="collapsible-control-panel-header">
        <span
          css={(theme: SupersetTheme) => css`
            font-size: ${theme.typography.sizes.m}px;
            line-height: 1.3;
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
              if (React.isValidElement(controlItem)) {
                // When the item is a React element
                return controlItem;
              }
              if (
                controlItem.name &&
                controlItem.config &&
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
    );
  };

  const hasControlsTransferred =
    ensureIsArray(exploreState.controlsTransferred).length > 0;

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
    if (!errorMessage) {
      dataTabHasHadNoErrors.current = true;
    }

    const errorColor = dataTabHasHadNoErrors.current
      ? colors.error.base
      : colors.alert.base;

    return (
      <>
        <span>{t('Data')}</span>
        {errorMessage && (
          <span
            css={(theme: SupersetTheme) => css`
              margin-left: ${theme.gridUnit * 2}px;
            `}
          >
            {' '}
            <Tooltip
              id="query-error-tooltip"
              placement="right"
              title={errorMessage}
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
    colors.alert.base,
    dataTabHasHadNoErrors,
    errorMessage,
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
          onQuery={onQuery}
          onStop={onStop}
          errorMessage={errorMessage}
          loading={chart.chartStatus === 'loading'}
          isNewChart={!chart.queriesResponse}
          canStopQuery={canStopQuery}
          chartIsStale={chartIsStale}
        />
      </div>
      <Modal
        width="480px"
        title={t(
          'Do you want to change the default temporal column to match the x-axis column?',
        )}
        footer={
          <>
            <Button htmlType="button" onClick={() => setShowXAxisModal(false)}>
              {t('No')}
            </Button>
            <Button
              htmlType="button"
              buttonStyle="primary"
              onClick={() => {
                actions.setControlValue(DEFAULT_TEMPORAL_COLUMN, x_axis);
                setShowXAxisModal(false);
              }}
            >
              {t('Yes')}
            </Button>
          </>
        }
        onHide={() => setShowXAxisModal(false)}
        show={showXAxisModal}
      >
        {t(
          `The column defined in the X-axis control is different than the one defined in the
          Default Temporal Column control, which is used for time-based filters in dashboards.`,
        )}
      </Modal>
    </Styles>
  );
};

export default ControlPanelsContainer;
