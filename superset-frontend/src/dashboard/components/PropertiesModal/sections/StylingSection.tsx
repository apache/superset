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
import { t, styled } from '@superset-ui/core';
import { CssEditor, Select } from '@superset-ui/core/components';
import ColorSchemeSelect from 'src/dashboard/components/ColorSchemeSelect';
import { ModalFormField } from 'src/components/Modal';

const StyledCssEditor = styled(CssEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
`;

interface Theme {
  id: number;
  theme_name: string;
}

interface StylingSectionProps {
  themes: Theme[];
  selectedThemeId: number | null;
  colorScheme?: string;
  customCss: string;
  hasCustomLabelsColor: boolean;
  onThemeChange: (value: any) => void;
  onColorSchemeChange: (
    colorScheme: string,
    options?: { updateMetadata?: boolean },
  ) => void;
  onCustomCssChange: (css: string) => void;
}

const StylingSection = ({
  themes,
  selectedThemeId,
  colorScheme,
  customCss,
  hasCustomLabelsColor,
  onThemeChange,
  onColorSchemeChange,
  onCustomCssChange,
}: StylingSectionProps) => (
  <>
    {themes.length > 0 && (
      <ModalFormField
        label={t('Theme')}
        helperText={t(
          'Clear the selection to revert to the system default theme',
        )}
      >
        <Select
          value={selectedThemeId}
          onChange={onThemeChange}
          options={themes.map(theme => ({
            value: theme.id,
            label: theme.theme_name,
          }))}
          allowClear
          placeholder={t('Select a theme')}
        />
      </ModalFormField>
    )}
    <ModalFormField
      label={t('Color scheme')}
      helperText={t(
        "Any color palette selected here will override the colors applied to this dashboard's individual charts",
      )}
    >
      <ColorSchemeSelect
        value={colorScheme}
        onChange={onColorSchemeChange}
        hasCustomLabelsColor={hasCustomLabelsColor}
        showWarning={hasCustomLabelsColor}
      />
    </ModalFormField>
    <ModalFormField
      label={t('Custom CSS')}
      helperText={t(
        'Apply custom CSS to the dashboard. Use class names or element selectors to target specific components.',
      )}
      bottomSpacing={false}
    >
      <StyledCssEditor
        onChange={onCustomCssChange}
        value={customCss}
        width="100%"
        minLines={10}
        maxLines={50}
        editorProps={{ $blockScrolling: true }}
      />
    </ModalFormField>
  </>
);

export default StylingSection;
