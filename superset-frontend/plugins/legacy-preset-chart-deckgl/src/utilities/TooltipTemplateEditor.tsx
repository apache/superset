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
// import { TooltipField } from './CustomTooltipControl';

export interface TooltipTemplateEditorProps {
  value: string;
  onChange: (template: string) => void;
  availableFields: TooltipField[];
  name: string;
}

const StyledTemplateEditor = styled.div`
  ${({ theme }) => `
    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px;
      background-color: ${theme.colors.grayscale.light5};
      border-radius: ${theme.sizeUnit}px;
      border: 1px solid ${theme.colors.grayscale.light2};
    }

    .available-fields {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit}px;
      margin-top: ${theme.sizeUnit * 2}px;
    }

    .field-tag {
      background-color: ${theme.colors.primary.light4};
      color: ${theme.colors.primary.dark1};
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border-radius: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      font-family: Monaco, monospace;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid ${theme.colors.primary.light2} !important;

      &:hover {
        background-color: ${theme.colors.primary.light3} !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px ${theme.colors.grayscale.light1}40;
      }

      &:active {
        transform: translateY(0);
      }

      &:focus {
        outline: 2px solid ${theme.colors.primary.base};
        outline-offset: 2px;
      }
    }

    .template-editor {
      margin-top: ${theme.sizeUnit * 2}px;

      textarea {
        width: 100%;
        min-height: 180px;
        padding: ${theme.sizeUnit * 2}px;
        border: 1px solid ${theme.colors.grayscale.light2};
        border-radius: ${theme.sizeUnit}px;
        font-family: Monaco, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
        resize: vertical;
        background-color: ${theme.colors.grayscale.light5};

        &:focus {
          outline: none;
          border-color: ${theme.colors.primary.base};
          box-shadow: 0 0 0 2px ${theme.colors.primary.light4};
        }
      }
    }

    .template-help {
      margin-top: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px;
      background-color: ${theme.colors.grayscale.light5};
      border-radius: ${theme.sizeUnit}px;
      border: 1px solid ${theme.colors.grayscale.light2};
      font-size: ${theme.fontSizeSM}px;

      .help-section {
        margin-bottom: ${theme.sizeUnit * 2}px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .help-title {
        font-weight: bold;
        color: ${theme.colors.grayscale.dark1};
        margin-bottom: ${theme.sizeUnit}px;
      }

      .help-example {
        background-color: ${theme.colors.grayscale.light3};
        padding: ${theme.sizeUnit * 2}px;
        border-radius: ${theme.sizeUnit}px;
        margin: ${theme.sizeUnit}px 0;
        font-family: Monaco, monospace;
        font-size: 12px;
        color: ${theme.colors.grayscale.dark2};
        white-space: pre-wrap;
        overflow-x: auto;
      }
    }

    .variable-counter {
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.fontSizeSM}px;
      font-style: italic;
    }
  `}
`;

const NoFieldsMessage = styled.p`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  font-style: italic;
  color: ${({ theme }) => theme.colorTextSecondary};
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 5}px;
`;

const HelpToggleButton = styled.button`
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-decoration: underline;
  color: ${({ theme }) => theme.colorPrimary};

  &:hover {
    color: ${({ theme }) => theme.colorPrimaryBorder};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colorPrimary};
    outline-offset: 2px;
  }
`;

interface TooltipField {
  id: string;
  name: string;
  label: string;
  type: string;
}

interface TooltipTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: TooltipField[];
  name: string;
  tooltipContents?: any[];
}

// Helper function to extract fields from tooltip contents
const extractFieldsFromTooltipContents = (
  tooltipContents: any[],
): TooltipField[] => {
  if (!tooltipContents || tooltipContents.length === 0) {
    return [];
  }

  return tooltipContents
    .map((item, index) => {
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
        fieldName = `tooltip_${item.metric_name || item.label}`;
        label =
          item.verbose_name ||
          item.metric_name ||
          item.label ||
          `Metric ${index + 1}`;
        type = 'metric';
      } else if (item?.column_name) {
        fieldName = `tooltip_${item.column_name}`;
        label = item.verbose_name || item.column_name || `Column ${index + 1}`;
        type = item.type || 'string';
      } else if (item?.metric_name || item?.label) {
        fieldName = `tooltip_${item.metric_name || item.label}`;
        label =
          item.verbose_name ||
          item.metric_name ||
          item.label ||
          `Metric ${index + 1}`;
        type = 'metric';
      }

      return {
        id: fieldName,
        name: fieldName,
        label,
        type,
      };
    })
    .filter(field => field.name);
};

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

  // Extract fields from tooltip contents if available
  const fieldsFromTooltipContents = useMemo(
    () => extractFieldsFromTooltipContents(tooltipContents),
    [tooltipContents],
  );

  // Use fields from tooltip contents if available, otherwise use prop fields
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
      if (textareaRef) {
        const cursorPos = textareaRef.selectionStart || 0;
        const newValue = `${value.slice(0, cursorPos)}{{${fieldName}}}${value.slice(cursorPos)}`;
        onChange(newValue);

        // Focus back to textarea and position cursor after inserted text
        setTimeout(() => {
          if (textareaRef) {
            const newCursorPos = cursorPos + `{{${fieldName}}}`.length;
            textareaRef.focus();
            textareaRef.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      } else {
        // Fallback if textarea ref is not available
        const newValue = `${value}{{${fieldName}}}`;
        onChange(newValue);
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

  // Auto-update template when tooltip contents change and template is default
  useEffect(() => {
    if (
      tooltipContents.length > 0 &&
      (!value || value.includes('Drop columns/metrics'))
    ) {
      // Generate basic template
      const templateRows = fieldsFromTooltipContents.map(
        field =>
          `  <div><strong>${field.label}:</strong> {{${field.name}}}</div>`,
      );

      const newTemplate = `<div class="custom-tooltip">
${templateRows.join('\n')}
</div>`;

      onChange(newTemplate);
    }
  }, [tooltipContents, fieldsFromTooltipContents, value, onChange]);

  return (
    <StyledTemplateEditor>
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
    </StyledTemplateEditor>
  );
}
