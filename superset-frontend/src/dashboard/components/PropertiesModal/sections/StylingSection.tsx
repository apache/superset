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
import { useCallback, useEffect, useState } from 'react';
import {
  t,
  styled,
  SupersetClient,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import { CssEditor, Select, Alert } from '@superset-ui/core/components';
import rison from 'rison';
import ColorSchemeSelect from 'src/dashboard/components/ColorSchemeSelect';
import { ModalFormField } from 'src/components/Modal';

const StyledCssEditor = styled(CssEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
`;

interface Theme {
  id: number;
  theme_name: string;
}

interface CssTemplate {
  template_name: string;
  css: string;
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
  addDangerToast?: (message: string) => void;
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
  addDangerToast,
}: StylingSectionProps) => {
  const [cssTemplates, setCssTemplates] = useState<CssTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [originalTemplateContent, setOriginalTemplateContent] =
    useState<string>('');

  // Fetch CSS templates
  const fetchCssTemplates = useCallback(async () => {
    if (!isFeatureEnabled(FeatureFlag.CssTemplates)) return;

    setIsLoadingTemplates(true);
    try {
      const query = rison.encode({ columns: ['template_name', 'css'] });
      const response = await SupersetClient.get({
        endpoint: `/api/v1/css_template/?q=${query}`,
      });
      setCssTemplates(response.json.result || []);
    } catch (error) {
      if (addDangerToast) {
        addDangerToast(
          t('An error occurred while fetching available CSS templates'),
        );
      }
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [addDangerToast]);

  useEffect(() => {
    fetchCssTemplates();
  }, [fetchCssTemplates]);

  // Handle CSS template selection
  const handleTemplateSelect = useCallback(
    (templateName: string) => {
      if (!templateName) {
        setSelectedTemplate(null);
        setOriginalTemplateContent('');
        return;
      }

      const template = cssTemplates.find(t => t.template_name === templateName);
      if (template) {
        setSelectedTemplate(templateName);
        setOriginalTemplateContent(template.css);
        onCustomCssChange(template.css);
      }
    },
    [cssTemplates, onCustomCssChange],
  );

  // Check if current CSS differs from original template
  const hasTemplateModification =
    selectedTemplate && customCss !== originalTemplateContent;

  return (
    <>
      {themes.length > 0 && (
        <ModalFormField
          label={t('Theme')}
          testId="dashboard-theme-field"
          helperText={t(
            'Clear the selection to revert to the system default theme',
          )}
        >
          <Select
            data-test="dashboard-theme-select"
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
        testId="dashboard-colorscheme-field"
        helperText={t(
          "Any color palette selected here will override the colors applied to this dashboard's individual charts",
        )}
      >
        <ColorSchemeSelect
          data-test="dashboard-colorscheme-select"
          value={colorScheme}
          onChange={onColorSchemeChange}
          hasCustomLabelsColor={hasCustomLabelsColor}
          showWarning={hasCustomLabelsColor}
        />
      </ModalFormField>
      {isFeatureEnabled(FeatureFlag.CssTemplates) &&
        cssTemplates.length > 0 && (
          <ModalFormField
            label={t('Load CSS template (optional)')}
            testId="dashboard-css-template-field"
            helperText={t(
              'Select a predefined CSS template to apply to your dashboard',
            )}
          >
            <Select
              data-test="dashboard-css-template-select"
              onChange={handleTemplateSelect}
              options={cssTemplates.map(template => ({
                value: template.template_name,
                label: template.template_name,
              }))}
              placeholder={t('Select a CSS template')}
              loading={isLoadingTemplates}
              allowClear
              value={selectedTemplate}
            />
          </ModalFormField>
        )}
      {hasTemplateModification && (
        <StyledAlert
          type="warning"
          message={t('Modified from "%s" template', selectedTemplate)}
          showIcon
          closable={false}
          data-test="css-template-modified-warning"
        />
      )}
      <ModalFormField
        label={t('CSS')}
        testId="dashboard-css-field"
        helperText={t(
          'Apply custom CSS to the dashboard. Use class names or element selectors to target specific components.',
        )}
        bottomSpacing={false}
      >
        <StyledCssEditor
          data-test="dashboard-css-editor"
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
};

export default StylingSection;
