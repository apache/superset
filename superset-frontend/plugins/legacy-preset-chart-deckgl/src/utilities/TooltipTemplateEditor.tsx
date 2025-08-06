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
import { t } from '@superset-ui/core';
import { StyledComponents } from './TooltipTemplateEditorStyles';

interface TooltipTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: string[];
  name: string;
  tooltipContents: any[];
}

export function TooltipTemplateEditor({
  value,
  onChange,
  availableFields,
  name,
  tooltipContents,
}: TooltipTemplateEditorProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange],
  );

  const insertField = useCallback(
    (field: string) => {
      const fieldTemplate = `{{${field}}}`;
      const newValue = localValue + fieldTemplate;
      setLocalValue(newValue);
      onChange(newValue);
    },
    [localValue, onChange],
  );

  const extractAvailableFields = () => {
    if (!tooltipContents || tooltipContents.length === 0) {
      return [];
    }

    const fields = new Set<string>();
    tooltipContents.forEach((item: any) => {
      if (item.column_name) {
        fields.add(item.column_name);
      }
      if (item.metric_name) {
        fields.add(item.metric_name);
      }
      if (item.label) {
        fields.add(item.label);
      }
    });

    return Array.from(fields);
  };

  const fields = extractAvailableFields();

  return (
    <StyledComponents>
      <div className="template-header">
        <h5>{t('Template Editor')}</h5>
        <span className="template-info">
          {t('Click on fields below to insert them into your template')}
        </span>
      </div>

      {fields.length > 0 && (
        <div className="available-fields">
          {fields.map(field => (
            <button
              key={field}
              type="button"
              className="field-tag"
              onClick={() => insertField(field)}
              title={t('Click to insert {{%s}}', field)}
            >
              {field}
            </button>
          ))}
        </div>
      )}

      <div className="template-editor">
        <textarea
          name={name}
          value={localValue}
          onChange={handleChange}
          placeholder={t(
            'Enter your Handlebars template here. Use {{field_name}} to insert values.',
          )}
        />
      </div>

      <div className="template-help">
        <div className="help-section">
          <h6>{t('Template Help')}</h6>
          <p>
            {t(
              'Use Handlebars syntax to create custom tooltips. Available variables will be populated based on your tooltip contents selection.',
            )}
          </p>
          <ul>
            <li>
              <code>{'{{field_name}}'}</code> - {t('Insert a field value')}
            </li>
            <li>
              <code>{'{{#if condition}}...{{/if}}'}</code> -{' '}
              {t('Conditional blocks')}
            </li>
            <li>
              <code>{'{{limit fields 10}}'}</code> -{' '}
              {t('Limit multi-value fields')}
            </li>
          </ul>
        </div>
      </div>
    </StyledComponents>
  );
}
