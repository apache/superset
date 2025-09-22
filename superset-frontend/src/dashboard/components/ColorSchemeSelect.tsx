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
import { ReactNode, useMemo } from 'react';
import {
  css,
  ColorScheme,
  ColorSchemeGroup,
  t,
  useTheme,
  getCategoricalSchemeRegistry,
  CategoricalScheme,
} from '@superset-ui/core';
import { sortBy } from 'lodash';
import { Select, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import ColorSchemeLabel from 'src/explore/components/controls/ColorSchemeControl/ColorSchemeLabel';

export interface ColorSchemes {
  [key: string]: ColorScheme;
}

interface ColorSchemeSelectProps {
  value?: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  hasCustomLabelsColor?: boolean;
  showWarning?: boolean;
}

const CUSTOM_LABEL_ALERT = t(
  `The colors of this chart might be overridden by custom label colors of the related dashboard.
    Check the JSON metadata in the Advanced settings.`,
);

const ColorSchemeSelect = ({
  value,
  onChange,
  clearable = true,
  hasCustomLabelsColor = false,
  showWarning = false,
}: ColorSchemeSelectProps) => {
  const theme = useTheme();
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();

  const schemes = useMemo(
    () => categoricalSchemeRegistry.getMap(),
    [categoricalSchemeRegistry],
  );

  const choices = useMemo(
    () => categoricalSchemeRegistry.keys().map(s => [s, s]),
    [categoricalSchemeRegistry],
  );

  const currentScheme = useMemo(() => {
    let result = value;
    if (result === 'SUPERSET_DEFAULT') {
      const defaultScheme = schemes?.SUPERSET_DEFAULT;
      if (
        defaultScheme &&
        typeof defaultScheme !== 'function' &&
        'id' in defaultScheme
      ) {
        result = (defaultScheme as CategoricalScheme).id;
      }
    }
    return result;
  }, [value, schemes]);

  const options = useMemo(() => {
    const allColorOptions: string[] = [];
    const filteredColorOptions = choices.filter(o => {
      const option = o[0];
      const isValidColorOption =
        option !== 'SUPERSET_DEFAULT' && !allColorOptions.includes(option);
      allColorOptions.push(option);
      return isValidColorOption;
    });

    const groups = filteredColorOptions.reduce(
      (acc, [value]) => {
        const schemeValue = schemes[value];

        // Type guard to ensure we have a CategoricalScheme
        if (!schemeValue || typeof schemeValue === 'function') {
          return acc;
        }

        const currentScheme = schemeValue as CategoricalScheme;

        let colors: string[] = [];
        if ('colors' in currentScheme) {
          ({ colors } = currentScheme);
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

        const group = currentScheme.group ?? ColorSchemeGroup.Other;
        acc[group].options.push(option);
        return acc;
      },
      {
        [ColorSchemeGroup.Custom]: {
          title: ColorSchemeGroup.Custom,
          label: t('Custom color palettes'),
          options: [] as any,
        },
        [ColorSchemeGroup.Featured]: {
          title: ColorSchemeGroup.Featured,
          label: t('Featured color palettes'),
          options: [] as any,
        },
        [ColorSchemeGroup.Other]: {
          title: ColorSchemeGroup.Other,
          label: t('Other color palettes'),
          options: [] as any,
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
  }, [choices, schemes]);

  return (
    <>
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
        onChange={onChange}
        placeholder={t('Select scheme')}
        value={currentScheme}
        showSearch
        getPopupContainer={triggerNode => triggerNode.parentNode}
        options={options}
        optionFilterProps={['label', 'value', 'searchText']}
      />
      {showWarning && hasCustomLabelsColor && (
        <Tooltip title={CUSTOM_LABEL_ALERT}>
          <Icons.WarningOutlined
            iconColor={theme.colorWarning}
            css={css`
              margin-left: ${theme.sizeUnit * 2}px;
              vertical-align: baseline;
            `}
            iconSize="s"
          />
        </Tooltip>
      )}
    </>
  );
};

export default ColorSchemeSelect;
