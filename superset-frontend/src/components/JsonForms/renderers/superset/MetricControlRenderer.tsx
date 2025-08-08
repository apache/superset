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

import { FC } from 'react';
import {
  ControlProps,
  RankedTester,
  rankWith,
  and,
  schemaMatches,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { t } from '@superset-ui/core';

/**
 * Renderer for Metric selection control
 * This is a placeholder that demonstrates how to integrate existing Superset controls
 */
export const MetricControlRenderer: FC<ControlProps> = ({
  data,
  handleChange,
  path,
  label,
  description,
  visible,
  required,
  errors,
}) => {
  if (!visible) {
    return null;
  }

  // For now, we'll render a placeholder
  // In a real implementation, this would render the actual MetricsControl component
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', marginBottom: '8px' }}>
        {label || t('Metric')}
        {required && <span style={{ color: 'red' }}> *</span>}
      </label>
      {description && (
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
          {description}
        </p>
      )}
      <div
        style={{
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          background: '#f5f5f5',
        }}
      >
        {t('Metric selector would be rendered here')}
        <br />
        <small>Current value: {JSON.stringify(data)}</small>
      </div>
      {errors && errors.length > 0 && (
        <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
          {(typeof errors === 'string' ? [errors] : errors).join(', ')}
        </div>
      )}
    </div>
  );
};

// Test for metric control - checks for specific property in uischema
export const metricControlTester: RankedTester = rankWith(
  10,
  and(
    schemaMatches(
      schema =>
        schema.type === 'array' ||
        (schema.type === 'object' && (schema as any).properties?.metric),
    ),
    (uischema, schema, rootSchema) =>
      (uischema as any).options?.controlType === 'MetricsControl',
  ),
);

export default withJsonFormsControlProps(MetricControlRenderer);
