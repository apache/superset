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
import React, { useMemo } from 'react';
import { ColorScheme, SequentialScheme, styled, t } from '@superset-ui/core';
import { isFunction } from 'lodash';
import { Select } from 'src/components';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import ColorSchemeLabel from './ColorSchemeLabel';

export interface ColorSchemes {
  [key: string]: ColorScheme;
}

export interface ColorSchemeControlProps {
  hasCustomLabelColors: boolean;
  dashboardId?: number;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  value: string;
  clearable: boolean;
  defaultScheme?: string;
  choices: string[][] | (() => string[][]);
  schemes: ColorSchemes | (() => ColorSchemes);
  isLinear: boolean;
}

const StyledAlert = styled(Icons.AlertSolid)`
  color: ${({ theme }) => theme.colors.alert.base};
`;

const CUSTOM_LABEL_ALERT = t(
  `This color scheme is being overridden by custom label colors.
    Check the JSON metadata in the Advanced settings`,
);

const DASHBOARD_ALERT = t(
  `The color scheme is determined by the related dashboard.
        Edit the color scheme in the dashboard properties.`,
);

const Label = ({
  label,
  hasCustomLabelColors,
  dashboardId,
}: Pick<
  ColorSchemeControlProps,
  'label' | 'hasCustomLabelColors' | 'dashboardId'
>) => {
  if (hasCustomLabelColors || dashboardId) {
    const alertTitle = hasCustomLabelColors
      ? CUSTOM_LABEL_ALERT
      : DASHBOARD_ALERT;
    return (
      <>
        {label}{' '}
        <Tooltip title={alertTitle}>
          <StyledAlert iconSize="s" />
        </Tooltip>
      </>
    );
  }
  return <>{label}</>;
};

const ColorSchemeControl = ({
  hasCustomLabelColors = false,
  dashboardId,
  label = t('Color scheme'),
  name,
  onChange = () => {},
  value,
  clearable = false,
  defaultScheme,
  choices = [],
  schemes = {},
  isLinear,
  ...rest
}: ColorSchemeControlProps) => {
  const currentScheme = useMemo(() => {
    if (dashboardId) {
      return 'dashboard';
    }
    let result = value || defaultScheme;
    if (result === 'SUPERSET_DEFAULT') {
      const schemesObject = isFunction(schemes) ? schemes() : schemes;
      result = schemesObject?.SUPERSET_DEFAULT?.id;
    }
    return result;
  }, [dashboardId, defaultScheme, schemes, value]);

  const options = useMemo(() => {
    if (dashboardId) {
      return [
        {
          value: 'dashboard',
          label: t('dashboard'),
          customLabel: (
            <Tooltip title={DASHBOARD_ALERT}>{t('Dashboard scheme')}</Tooltip>
          ),
        },
      ];
    }
    const schemesObject = isFunction(schemes) ? schemes() : schemes;
    const controlChoices = isFunction(choices) ? choices() : choices;
    const allColorOptions: string[] = [];
    const filteredColorOptions = controlChoices.filter(o => {
      const option = o[0];
      const isValidColorOption =
        option !== 'SUPERSET_DEFAULT' && !allColorOptions.includes(option);
      allColorOptions.push(option);
      return isValidColorOption;
    });

    return filteredColorOptions.map(([value]) => {
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
      return {
        customLabel: (
          <ColorSchemeLabel
            id={currentScheme.id}
            label={currentScheme.label}
            colors={colors}
          />
        ),
        label: schemesObject?.[value]?.label || value,
        value,
      };
    });
  }, [choices, dashboardId, isLinear, schemes]);

  // We can't pass on change directly because it receives a second
  // parameter and it would be interpreted as the error parameter
  const handleOnChange = (value: string) => onChange(value);

  return (
    <Select
      header={
        <ControlHeader
          {...rest}
          label={
            <Label
              label={label}
              hasCustomLabelColors={hasCustomLabelColors}
              dashboardId={dashboardId}
            />
          }
        />
      }
      ariaLabel={t('Select color scheme')}
      allowClear={clearable}
      disabled={!!dashboardId}
      name={`select-${name}`}
      onChange={handleOnChange}
      options={options}
      placeholder={t('Select scheme')}
      value={currentScheme}
    />
  );
};

export default ColorSchemeControl;
