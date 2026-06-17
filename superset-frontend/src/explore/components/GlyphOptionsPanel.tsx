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

/**
 * GlyphOptionsPanel - Native React renderer for the Customize tab of glyph-core charts.
 *
 * Uses the fully-processed "Chart Options" section (from getSectionsToRender) as the
 * authoritative list of controls and their order. For each control:
 *
 *   - If the control name appears in `_glyphArgs`: rendered natively — value from
 *     formData directly, visibility from evaluateGlyphCondition(visibleWhen, formData),
 *     no Redux controls-state dependency.
 *
 *   - Otherwise (additionalControls.chartOptions entries): rendered via the existing
 *     `renderControl()` callback, which reads values from Redux controls state and
 *     evaluates legacy visibility() functions. Full compatibility preserved.
 *
 * This hybrid strategy means every chart — even ones with many hand-crafted additional
 * controls in the Customize tab (Timeseries, BigNumber, MixedTimeseries, etc.) — works
 * correctly while glyph-defined args get the simplified formData-based path.
 */

import {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useMemo,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { JsonValue, QueryFormData } from '@superset-ui/core';
import {
  ControlState,
  ControlType,
  CustomControlItem,
  isCustomControlItem,
} from '@superset-ui/chart-controls';
import {
  type ArgDef,
  type ChartArguments,
  evaluateGlyphCondition,
  getArgVisibleWhen,
  getGlyphControlConfig,
  isDimensionArg,
  isMetricArg,
  isTemporalArg,
  resolveArgClass,
} from '@superset-ui/glyph-core';
import { Collapse } from '@superset-ui/core/components';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import Control from './Control';
import ControlRow from './ControlRow';
import StashFormDataContainer from './StashFormDataContainer';
import { ExpandedControlPanelSectionConfig } from './ControlPanelsContainer';

interface GlyphOptionsPanelProps {
  /** Raw glyph arg definitions from defineChart() (_glyphArgs on ControlPanelConfig) */
  glyphArgs: ChartArguments;
  /**
   * The fully-processed "Chart Options" section from getSectionsToRender.
   * This is the source of truth for control order and includes both glyph args
   * AND any additionalControls.chartOptions entries.
   */
  chartOptionsSection: ExpandedControlPanelSectionConfig;
  formData: QueryFormData;
  /** Redux controls state — used for validation errors on non-glyph controls */
  controls: Record<string, ControlState>;
  actions: Pick<ExploreActions, 'setControlValue'>;
  /** Existing renderer for non-glyph additional controls */
  renderControl: (item: CustomControlItem) => ReactNode;
  defaultExpandedKeys?: string[];
}

const EMPTY_ERRORS: unknown[] = [];

/**
 * Render a single glyph arg control natively (value + visibility from formData).
 */
function GlyphArgControl({
  name,
  argDef,
  formData,
  controls,
  actions,
}: {
  name: string;
  argDef: ArgDef;
  formData: QueryFormData;
  controls: Record<string, ControlState>;
  actions: Pick<ExploreActions, 'setControlValue'>;
}) {
  const formDataRecord = formData as Record<string, unknown>;
  // The config is deterministic per (argDef, name) — don't rebuild it (and its
  // nested option arrays) on every keystroke-driven re-render.
  const { visibleWhen, controlConfig } = useMemo(
    () => ({
      visibleWhen: getArgVisibleWhen(argDef),
      controlConfig: getGlyphControlConfig(
        resolveArgClass(argDef),
        name,
      ) as Record<string, unknown> & { type: string },
    }),
    [argDef, name],
  );

  const isVisible = visibleWhen
    ? evaluateGlyphCondition(visibleWhen, formDataRecord)
    : undefined;

  const { type, label, description, ...restConfig } = controlConfig;
  // Stable empty-array reference so PureComponent controls can bail out
  const validationErrors = controls[name]?.validationErrors ?? EMPTY_ERRORS;

  return (
    <StashFormDataContainer
      shouldStash={isVisible === false}
      fieldNames={[name]}
    >
      <Control
        name={name}
        type={type as ControlType}
        value={formDataRecord[name] as JsonValue}
        label={label as string | undefined}
        description={description as string | undefined}
        validationErrors={validationErrors}
        isVisible={isVisible}
        renderTrigger
        resetOnHide={false}
        actions={actions}
        {...(restConfig as Record<string, unknown>)}
      />
    </StashFormDataContainer>
  );
}

/**
 * Renders the Chart Options section for a glyph-core chart with hybrid strategy:
 * native formData rendering for glyph args, existing renderControl for everything else.
 */
export default function GlyphOptionsPanel({
  glyphArgs,
  chartOptionsSection,
  formData,
  controls,
  actions,
  renderControl,
  defaultExpandedKeys,
}: GlyphOptionsPanelProps) {
  // Build the set of arg names that are data args (go in the Query/Data tab, not here)
  const dataArgNames = useMemo(
    () =>
      new Set(
        Object.entries(glyphArgs)
          .filter(([, argDef]) => {
            const argClass = resolveArgClass(argDef as ArgDef);
            return (
              isMetricArg(argClass) ||
              isDimensionArg(argClass) ||
              isTemporalArg(argClass)
            );
          })
          .map(([name]) => name),
      ),
    [glyphArgs],
  );

  const rows = chartOptionsSection.controlSetRows
    .map((controlSetRow, rowIndex) => {
      const renderedControls = controlSetRow
        .map(item => {
          if (!item) return null;

          // JSX rows (sub-section headers, dividers) — render them like the
          // legacy section renderer does instead of silently dropping them.
          if (isValidElement(item)) {
            const element = item as ReactElement<Record<string, unknown>>;
            const controlName = (element.props as { name?: string }).name;
            if (!controlName) {
              return element;
            }
            const controlState = controls[controlName];
            return cloneElement(element, {
              ...(element.props as Record<string, unknown>),
              actions,
              controls,
              form_data: formData,
              ...(controlState && {
                value: controlState.value,
                validationErrors: controlState.validationErrors,
                default: controlState.default,
                onChange: (value: unknown, errors: unknown[]) =>
                  actions.setControlValue(controlName, value, errors),
              }),
            });
          }

          if (isCustomControlItem(item)) {
            const { name } = item;
            const argDef = glyphArgs[name] as ArgDef | undefined;

            // Controls whose config needs mapStateToProps (e.g. conditional
            // formatting deriving column options from the chart response, or
            // disabledWhen) must go through the legacy renderControl path —
            // the native path has no exploreState/chart to map from.
            const needsStateMapping =
              item.config && 'mapStateToProps' in item.config;

            if (argDef && !dataArgNames.has(name) && !needsStateMapping) {
              // Native glyph rendering: value from formData, visibility from formData
              return (
                <GlyphArgControl
                  key={`glyph-native-${name}`}
                  name={name}
                  argDef={argDef}
                  formData={formData}
                  controls={controls}
                  actions={actions}
                />
              );
            }

            // additionalControls.chartOptions: use existing renderControl path
            return renderControl(item);
          }

          return null;
        })
        .filter(Boolean) as React.ReactElement[];

      if (renderedControls.length === 0) return null;

      return (
        <ControlRow key={`glyph-row-${rowIndex}`} controls={renderedControls} />
      );
    })
    .filter(Boolean) as ReactNode[];

  if (rows.length === 0) return null;

  return (
    <Collapse
      defaultActiveKey={
        defaultExpandedKeys ?? [String(chartOptionsSection.label)]
      }
      expandIconPosition="end"
      ghost
      bordered
      items={[
        {
          key: String(chartOptionsSection.label ?? t('Chart Options')),
          label: String(chartOptionsSection.label ?? t('Chart Options')),
          children: <>{rows}</>,
        },
      ]}
    />
  );
}
