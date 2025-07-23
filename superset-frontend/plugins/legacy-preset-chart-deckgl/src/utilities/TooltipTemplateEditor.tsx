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

import { useState, useCallback, useMemo, useEffect } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import {
  StyledComponents,
  NoFieldsMessage,
  HelpToggleButton,
} from './TooltipTemplateEditorStyles';

export interface TooltipTemplateEditorProps {
  value: string;
  onChange: (template: string) => void;
  availableFields: TooltipField[];
  name: string;
  tooltipContents?: any[];
}

interface TooltipField {
  id: string;
  name: string;
  label: string;
  type: string;
}

function extractFieldFromItem(item: any, index: number): TooltipField | null {
  let fieldName = '';
  let label = '';
  let type = 'string';

  if (typeof item === 'string') {
    fieldName = `tooltip_${item}`;
    label = item;
  } else if (item?.item_type === 'column') {
    fieldName = `tooltip_${item.column_name}`;
    label =
      item.verbose_name ||
      item.column_name ||
      item.label ||
      `Column ${index + 1}`;
    type = item.type || 'string';
  } else if (item?.item_type === 'metric') {
    const metricName = item.metric_name || item.label;
    fieldName = `tooltip_${metricName}`;
    label = item.verbose_name || metricName || `Metric ${index + 1}`;
    type = 'metric';
  } else if (item?.column_name) {
    fieldName = `tooltip_${item.column_name}`;
    label = item.verbose_name || item.column_name || `Column ${index + 1}`;
    type = item.type || 'string';
  } else if (item?.metric_name || item?.label) {
    const metricName = item.metric_name || item.label;
    fieldName = `tooltip_${metricName}`;
    label = item.verbose_name || metricName || `Metric ${index + 1}`;
    type = 'metric';
  }

  if (!fieldName) return null;

  return { id: fieldName, name: fieldName, label, type };
}

function extractFieldsFromTooltipContents(
  tooltipContents: any[],
): TooltipField[] {
  if (!tooltipContents || tooltipContents.length === 0) {
    return [];
  }

  return tooltipContents
    .map((item, index) => extractFieldFromItem(item, index))
    .filter((field): field is TooltipField => field !== null);
}

function generateDefaultTemplate(fields: TooltipField[]): string {
  const templateRows = fields.map(
    field => `  <div><strong>${field.label}:</strong> {{${field.name}}}</div>`,
  );

  return `<div class="custom-tooltip">
${templateRows.join('\n')}
</div>`;
}

function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  currentValue: string,
): { newValue: string; newCursorPos: number } {
  const cursorPos = textarea.selectionStart || 0;
  const newValue = `${currentValue.slice(0, cursorPos)}${text}${currentValue.slice(cursorPos)}`;
  const newCursorPos = cursorPos + text.length;

  return { newValue, newCursorPos };
}

export function TooltipTemplateEditor({
  value,
  onChange,
  availableFields: propAvailableFields,
  name,
  tooltipContents = [],
}: TooltipTemplateEditorProps) {
  const theme = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(
    null,
  );

  const fieldsFromTooltipContents = useMemo(
    () => extractFieldsFromTooltipContents(tooltipContents),
    [tooltipContents],
  );

  const availableFields = useMemo(
    () =>
      fieldsFromTooltipContents.length > 0
        ? fieldsFromTooltipContents
        : propAvailableFields,
    [fieldsFromTooltipContents, propAvailableFields],
  );

  const handleTemplateChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  const handleFieldClick = useCallback(
    (fieldName: string) => {
      const textToInsert = `{{${fieldName}}}`;

      if (textareaRef) {
        const { newValue, newCursorPos } = insertTextAtCursor(
          textareaRef,
          textToInsert,
          value,
        );
        onChange(newValue);

        setTimeout(() => {
          if (textareaRef) {
            textareaRef.focus();
            textareaRef.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      } else {
        onChange(`${value}${textToInsert}`);
      }
    },
    [value, onChange, textareaRef],
  );

  const fieldTags = useMemo(
    () =>
      availableFields.map(field => (
        <button
          key={field.id}
          type="button"
          className="field-tag"
          onClick={() => handleFieldClick(field.name)}
          title={t('Click to insert field: {{%s}}', field.name)}
          style={{ border: 'none', background: 'transparent' }}
        >
          {`{{${field.name}}}`}
        </button>
      )),
    [availableFields, handleFieldClick],
  );

  useEffect(() => {
    if (
      tooltipContents.length > 0 &&
      (!value || value.includes('Drop columns/metrics'))
    ) {
      const newTemplate = generateDefaultTemplate(fieldsFromTooltipContents);
      onChange(newTemplate);
    }
  }, [tooltipContents, fieldsFromTooltipContents, onChange, value]);

  return (
    <StyledComponents>
      <div className="template-header">
        <div>
          <strong>{t('Available Template Variables')}</strong>
          {availableFields.length > 0 && (
            <span className="variable-counter">
              {t(' (%s variables)', availableFields.length)}
            </span>
          )}
        </div>
        <HelpToggleButton type="button" onClick={() => setShowHelp(!showHelp)}>
          {showHelp ? t('Hide Help') : t('Show Help')}
        </HelpToggleButton>
      </div>

      {availableFields.length > 0 ? (
        <div className="available-fields">{fieldTags}</div>
      ) : (
        <NoFieldsMessage>
          {t(
            'Add fields in "Tooltip contents" above to see available template variables',
          )}
        </NoFieldsMessage>
      )}

      <div className="template-editor">
        <textarea
          ref={setTextareaRef}
          value={value}
          onChange={handleTemplateChange}
          placeholder={t('Enter your tooltip template here...')}
          data-test={`${name}-template-editor`}
        />
      </div>

      {showHelp && (
        <div className="template-help">
          <div className="help-section">
            <div className="help-title">{t('Template Syntax')}</div>
            <p>
              {t(
                'Use Handlebars syntax to create dynamic tooltips with built-in formatting helpers.',
              )}
            </p>
            <div className="help-example">
              {`<div>
  <strong>{{field_name}}:</strong> {{field_value}}
</div>`}
            </div>
          </div>

          <div className="help-section">
            <div className="help-title">{t('Conditional Content')}</div>
            <p>{t('Show content only when field has a value:')}</p>
            <div className="help-example">
              {`{{#if field_name}}
  <div>Value: {{field_name}}</div>
{{else}}
  <div>No value available</div>
{{/if}}`}
            </div>
          </div>

          <div className="help-section">
            <div className="help-title">{t('Built-in Helpers')}</div>
            <p>{t('Handlebars provides powerful formatting helpers:')}</p>
            <div className="help-example">
              {`<!-- Format numbers -->
<div>{{formatNumber my_number}}</div>

<!-- Format dates -->
<div>{{dateFormat my_date format="YYYY-MM-DD HH:mm:ss"}}</div>

<!-- Convert objects to JSON -->
<div>{{stringify my_object}}</div>

<!-- Default values -->
<div>{{default my_value "N/A"}}</div>

<!-- Conditional display -->
{{#ifExists my_value}}
  <div>Value exists: {{my_value}}</div>
{{/ifExists}}

<!-- Truncate text -->
<div>{{truncate my_long_text 50}}</div>

<!-- Format coordinates -->
<div>{{formatCoordinate longitude latitude}}</div>`}
            </div>
          </div>

          <div className="help-section">
            <div className="help-title">{t('CSS Styling')}</div>
            <p>{t('Use CSS classes and styles for better formatting:')}</p>
            <div className="help-example">
              {`<div class="custom-tooltip">
  <div class="tooltip-header">
    <h4>{{title}}</h4>
  </div>
  <div class="tooltip-content">
    <div class="metric-row">
      <strong>{{label}}:</strong>
      <span class="metric-value">{{value}}</span>
    </div>
  </div>
</div>`}
            </div>
          </div>
        </div>
      )}
    </StyledComponents>
  );
}
