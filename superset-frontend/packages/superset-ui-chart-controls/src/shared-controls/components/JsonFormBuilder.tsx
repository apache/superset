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
import { FC, ReactElement } from 'react';
import { JsonValue, t } from '@superset-ui/core';
import { Select, Switch, Input } from '@superset-ui/core/components';
import { ControlHeader } from '../../components/ControlHeader';
import GranularityControl from './GranularityControl';

export interface JsonFormField {
  name: string;
  type: 'select' | 'text' | 'number' | 'boolean' | 'granularity' | 'custom';
  label?: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  default?: JsonValue;
  options?: Array<{ value: string; label: string }>;
  component?: FC<any>;
  props?: Record<string, any>;
  visible?: (values: Record<string, JsonValue>) => boolean;
  validation?: (value: JsonValue) => string | null;
}

export interface JsonFormSection {
  key: string;
  label: string;
  description?: string;
  fields: JsonFormField[];
}

export interface JsonFormConfig {
  sections: JsonFormSection[];
}

interface JsonFormBuilderProps {
  config: JsonFormConfig;
  values: Record<string, JsonValue>;
  onChange: (name: string, value: JsonValue) => void;
  validationErrors?: Record<string, string[]>;
}

/**
 * Renders a single form field based on its type
 */
const FormField: FC<{
  field: JsonFormField;
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  error?: string[];
}> = ({ field, value, onChange, error }) => {
  const commonProps = {
    value,
    onChange,
    placeholder: field.placeholder,
    ...field.props,
  };

  let control: ReactElement;

  switch (field.type) {
    case 'select':
      control = (
        <Select
          value={value as any}
          options={field.options || []}
          allowClear={!field.required}
          css={{ width: '100%' }}
          onChange={(val: any) => onChange(val)}
          placeholder={field.placeholder}
          {...field.props}
        />
      );
      break;

    case 'text':
      control = (
        <Input
          {...commonProps}
          value={value as string}
          onChange={(e: any) => onChange(e.target.value)}
        />
      );
      break;

    case 'number':
      control = (
        <Input
          {...commonProps}
          value={value as number}
          type="number"
          onChange={(e: any) => onChange(Number(e.target.value))}
        />
      );
      break;

    case 'boolean':
      control = (
        <Switch
          checked={Boolean(value)}
          onChange={(checked: boolean) => onChange(checked)}
          {...field.props}
        />
      );
      break;

    case 'granularity':
      control = (
        <GranularityControl
          name={field.name}
          value={value as any}
          onChange={onChange}
          {...field.props}
        />
      );
      break;

    case 'custom':
      if (field.component) {
        const CustomComponent = field.component;
        control = (
          <CustomComponent value={value} onChange={onChange} {...field.props} />
        );
      } else {
        control = <div>{t('Custom component not provided')}</div>;
      }
      break;

    default:
      control = <div>{t('Unknown field type')}</div>;
  }

  return (
    <div className="form-field" style={{ marginBottom: '16px' }}>
      {field.type !== 'granularity' && (
        <ControlHeader
          name={field.name}
          label={field.label || field.name}
          description={field.description}
          validationErrors={error}
          required={field.required}
        />
      )}
      {control}
    </div>
  );
};

/**
 * A JSON-driven form builder that creates forms from configuration
 */
export const JsonFormBuilder: FC<JsonFormBuilderProps> = ({
  config,
  values,
  onChange,
  validationErrors = {},
}) => (
  <div className="json-form-builder">
    {config.sections.map(section => (
      <div key={section.key} className="form-section">
        <h4>{section.label}</h4>
        {section.description && (
          <p className="section-description">{section.description}</p>
        )}
        <div className="form-fields">
          {section.fields.map(field => {
            // Check visibility
            if (field.visible && !field.visible(values)) {
              return null;
            }

            return (
              <FormField
                key={field.name}
                field={field}
                value={values[field.name] ?? field.default ?? null}
                onChange={value => onChange(field.name, value)}
                error={validationErrors[field.name]}
              />
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

/**
 * Helper to create a control panel from JSON configuration
 */
export function createJsonFormControlPanel(
  config: JsonFormConfig,
): ReactElement {
  return (
    <JsonFormBuilder
      config={config}
      values={{}}
      onChange={() => {}}
      validationErrors={{}}
    />
  );
}
