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
import { useMemo, ReactNode } from 'react';

import {
  css,
  ColorScheme,
  ColorSchemeGroup,
  SequentialScheme,
  t,
  useTheme,
  getLabelsColorMap,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import { sortBy } from 'lodash';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  Tooltip,
  Select,
  type SelectOptionsType,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { getColorNamespace } from 'src/utils/colorScheme';
import ColorSchemeLabel from './ColorSchemeLabel';

export type OptionData = SelectOptionsType[number]['options'][number] & {
  searchText?: string;
};

export interface ColorSchemes {
  [key: string]: ColorScheme;
}

export interface ColorSchemeControlProps {
  hasCustomLabelsColor: boolean;
  hasDashboardColorScheme?: boolean;
  hasSharedLabelsColor?: boolean;
  sharedLabelsColors?: string[];
  mapLabelsColors?: Record<string, any>;
  colorNamespace?: string;
  chartId?: number;
  dashboardId?: number;
  label?: string;
  name: string;
  onChange?: (value: string) => void;
  value: string;
  clearable: boolean;
  defaultScheme?: string;
  choices: string[][] | (() => string[][]);
  schemes: ColorSchemes | (() => ColorSchemes);
  isLinear?: boolean;
  description?: string;
  hovered?: boolean;
}

const CUSTOM_LABEL_ALERT = t(
  `The colors of this chart might be overridden by custom label colors of the related dashboard.
    Check the JSON metadata in the Advanced settings.`,
);

const DASHBOARD_ALERT = t(
  `The color scheme is determined by the related dashboard.
        Edit the color scheme in the dashboard properties.`,
);

const DASHBOARD_CONTEXT_ALERT = t(
  `You are viewing this chart in a dashboard context with labels shared across multiple charts.
        The color scheme selection is disabled.`,
);

const DASHBOARD_CONTEXT_TOOLTIP = t(
  `You are viewing this chart in the context of a dashboard that is directly affecting its colors.
        To edit the color scheme, open this chart outside of the dashboard.`,
);

const Label = ({
  label,
  dashboardId,
  hasSharedLabelsColor,
  hasCustomLabelsColor,
  hasDashboardColorScheme,
}: Pick<
  ColorSchemeControlProps,
  | 'label'
  | 'dashboardId'
  | 'hasCustomLabelsColor'
  | 'hasSharedLabelsColor'
  | 'hasDashboardColorScheme'
>) => {
  const theme = useTheme();
  if (hasSharedLabelsColor || hasCustomLabelsColor || hasDashboardColorScheme) {
    const alertTitle =
      hasCustomLabelsColor && !hasSharedLabelsColor
        ? CUSTOM_LABEL_ALERT
        : dashboardId && hasDashboardColorScheme
          ? DASHBOARD_ALERT
          : DASHBOARD_CONTEXT_ALERT;
    return (
      <>
        {label}{' '}
        <Tooltip title={alertTitle}>
          <Icons.WarningOutlined
            iconColor={theme.colorWarning}
            css={css`
              vertical-align: baseline;
            `}
            iconSize="s"
          />
        </Tooltip>
      </>
    );
  }
  return <>{label}</>;
};

const ColorSchemeControl = ({
  hasCustomLabelsColor = false,
  hasDashboardColorScheme = false,
  mapLabelsColors = {},
  sharedLabelsColors = [],
  dashboardId,
  colorNamespace,
  chartId,
  label = t('Color scheme'),
  onChange = () => {},
  value,
  clearable = false,
  defaultScheme,
  choices = [],
  schemes = {},
  isLinear,
  ...rest
}: ColorSchemeControlProps) => {
  const countSharedLabelsColor = sharedLabelsColors.length;
  const colorMapInstance = getLabelsColorMap();
  const chartLabels = chartId
    ? colorMapInstance.chartsLabelsMap.get(chartId)?.labels || []
    : [];
  const hasSharedLabelsColor = !!(
    dashboardId &&
    countSharedLabelsColor > 0 &&
    chartLabels.some(label => sharedLabelsColors.includes(label))
  );
  const hasDashboardScheme = dashboardId && hasDashboardColorScheme;
  const showDashboardLockedOption = hasDashboardScheme || hasSharedLabelsColor;
  const theme = useTheme();
  const currentScheme = useMemo(() => {
    if (showDashboardLockedOption) {
      return 'dashboard';
    }
    let result = value || defaultScheme;
    if (result === 'SUPERSET_DEFAULT') {
      const schemesObject = typeof schemes === 'function' ? schemes() : schemes;
      result = schemesObject?.SUPERSET_DEFAULT?.id;
    }
    return result;
  }, [defaultScheme, schemes, showDashboardLockedOption, value]);

  const options = useMemo(() => {
    if (showDashboardLockedOption) {
      return [
        {
          value: 'dashboard',
          label: (
            <Tooltip title={DASHBOARD_CONTEXT_TOOLTIP}>
              {t('Dashboard scheme')}
            </Tooltip>
          ),
        },
      ];
    }
    const schemesObject = typeof schemes === 'function' ? schemes() : schemes;
    const controlChoices = typeof choices === 'function' ? choices() : choices;
    const allColorOptions: string[] = [];
    const filteredColorOptions = controlChoices.filter(o => {
      const option = o[0];
      const isValidColorOption =
        option !== 'SUPERSET_DEFAULT' && !allColorOptions.includes(option);
      allColorOptions.push(option);
      return isValidColorOption;
    });

    const groups = filteredColorOptions.reduce(
      (acc, [value]) => {
        const currentScheme = schemesObject[value];

        // For categorical scheme, display all the colors
        // For sequential scheme, show 10 or interpolate to 10.
        // Sequential schemes usually have at most 10 colors.
        let colors: string[] = [];
        if (currentScheme) {
          colors = isLinear
            ? (currentScheme as SequentialScheme).getColors(10)
            : currentScheme.colors;
        }
        const option = {
          label: (
            <ColorSchemeLabel
              id={currentScheme.id}
              label={currentScheme.label}
              colors={colors}
            />
          ) as ReactNode,
          value,
          searchText: currentScheme.label,
        };
        acc[currentScheme.group ?? ColorSchemeGroup.Other].options.push(option);
        return acc;
      },
      {
        [ColorSchemeGroup.Custom]: {
          title: ColorSchemeGroup.Custom,
          label: t('Custom color palettes'),
          options: [] as OptionData,
        },
        [ColorSchemeGroup.Featured]: {
          title: ColorSchemeGroup.Featured,
          label: t('Featured color palettes'),
          options: [] as OptionData,
        },
        [ColorSchemeGroup.Other]: {
          title: ColorSchemeGroup.Other,
          label: t('Other color palettes'),
          options: [] as OptionData,
        },
      },
    );
    const nonEmptyGroups = Object.values(groups)
      .filter(group => group.options.length > 0)
      .map(group => ({
        ...group,
        options: sortBy(group.options, opt => opt.label),
      }));

    // if there are no featured or custom color schemes, return the ungrouped options
    if (
      nonEmptyGroups.length === 1 &&
      nonEmptyGroups[0].title === ColorSchemeGroup.Other
    ) {
      return nonEmptyGroups[0].options.map(opt => ({
        value: opt.value,
        label: opt.customLabel || opt.label,
      }));
    }
    return nonEmptyGroups.map(group => ({
      label: group.label,
      options: group.options.map(opt => ({
        value: opt.value,
        label: opt.customLabel || opt.label,
        searchText: opt.searchText,
      })),
    }));
  }, [choices, hasDashboardScheme, hasSharedLabelsColor, isLinear, schemes]);

  // We can't pass on change directly because it receives a second
  // parameter and it would be interpreted as the error parameter
  const handleOnChange = (value: string) => {
    if (chartId) {
      colorMapInstance.setOwnColorScheme(chartId, value);
      if (dashboardId) {
        const colorNameSpace = getColorNamespace(colorNamespace);
        const categoricalNamespace =
          CategoricalColorNamespace.getNamespace(colorNameSpace);

        const sharedLabelsSet = new Set(sharedLabelsColors);
        // reset colors except shared and custom labels to keep dashboard consistency
        const resettableLabels = Object.keys(mapLabelsColors).filter(
          l => !sharedLabelsSet.has(l),
        );
        categoricalNamespace.resetColorsForLabels(resettableLabels);
      }
    }

    onChange(value);
  };

  return (
    <>
      <ControlHeader
        {...rest}
        label={
          <Label
            label={label}
            dashboardId={dashboardId}
            hasCustomLabelsColor={hasCustomLabelsColor}
            hasDashboardColorScheme={hasDashboardColorScheme}
            hasSharedLabelsColor={hasSharedLabelsColor}
          />
        }
      />
      <Select
        css={css`
          width: 100%;
          & .ant-select-item.ant-select-item-group {
            padding-left: ${theme.sizeUnit}px;
            font-size: ${theme.fontSize}px;
          }
          & .ant-select-item-option-grouped {
            padding-left: ${theme.sizeUnit * 3}px;
          }
        `}
        aria-label={t('Select color scheme')}
        allowClear={clearable}
        disabled={hasDashboardScheme || hasSharedLabelsColor}
        onChange={handleOnChange}
        placeholder={t('Select scheme')}
        value={currentScheme}
        showSearch
        getPopupContainer={triggerNode => triggerNode.parentNode}
        options={options}
        optionFilterProps={['label', 'value', 'searchText']}
      />
    </>
  );
};

export default ColorSchemeControl;
