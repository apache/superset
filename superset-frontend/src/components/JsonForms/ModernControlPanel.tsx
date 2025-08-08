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

import { FC, useMemo, useState, useEffect, useCallback } from 'react';
import { JsonForms } from '@jsonforms/react';
import {
  JsonSchema7,
  UISchemaElement,
  JsonFormsRendererRegistryEntry,
} from '@jsonforms/core';
import { ControlPanelConfig, ControlState } from '@superset-ui/chart-controls';
import { QueryFormData } from '@superset-ui/core';
import { generateSchemaFromControlPanel } from './schemaGenerator';
import { antdRenderers } from './renderers/antd';
import { supersetRenderers } from './renderers/superset';

export interface ModernControlPanelProps {
  // For incremental migration - can accept either old config or new schema
  config?: ControlPanelConfig;
  schema?: JsonSchema7;
  uischema?: UISchemaElement;

  // Form data and controls
  formData: QueryFormData;
  controls?: Record<string, ControlState>;

  // Callbacks
  onChange: (formData: QueryFormData) => void;
  onValidationError?: (errors: any[]) => void;

  // Optional custom renderers
  customRenderers?: JsonFormsRendererRegistryEntry[];

  // Enable local state management for inter-control communication
  enableLocalState?: boolean;
}

/**
 * Modern control panel using JSON Forms
 * Supports both schema-based and config-based approaches for incremental migration
 */
const ModernControlPanel: FC<ModernControlPanelProps> = ({
  config,
  schema: providedSchema,
  uischema: providedUischema,
  formData,
  controls = {},
  onChange,
  onValidationError,
  customRenderers = [],
  enableLocalState = true,
}) => {
  // Local state for inter-control communication
  const [localFormData, setLocalFormData] = useState(formData);

  // Generate schema from config if not provided
  const { schema, uischema } = useMemo(() => {
    if (providedSchema && providedUischema) {
      return { schema: providedSchema, uischema: providedUischema };
    }

    if (config) {
      return generateSchemaFromControlPanel(config, controls);
    }

    // Default empty schema
    return {
      schema: { type: 'object', properties: {} },
      uischema: { type: 'VerticalLayout', elements: [] },
    };
  }, [config, controls, providedSchema, providedUischema]);

  // Combine all renderers
  const renderers = useMemo(
    () => [
      ...supersetRenderers, // Highest priority for Superset-specific controls
      ...customRenderers, // Custom renderers from props
      ...antdRenderers, // Default AntD renderers
    ],
    [customRenderers],
  );

  // Handle form data changes
  const handleChange = useCallback(
    ({ data, errors }: any) => {
      if (enableLocalState) {
        setLocalFormData(data);
      }

      // Notify parent component
      onChange(data);

      if (onValidationError && errors && errors.length > 0) {
        onValidationError(errors);
      }
    },
    [enableLocalState, onChange, onValidationError],
  );

  // Sync external formData changes
  useEffect(() => {
    if (!enableLocalState || formData !== localFormData) {
      setLocalFormData(formData);
    }
  }, [formData, enableLocalState]);

  // Additional context for renderers (commented out as not used yet)
  // const additionalContext = useMemo(() => ({
  //   controls,
  //   datasource: formData?.datasource,
  //   vizType: formData?.viz_type,
  // }), [controls, formData?.datasource, formData?.viz_type]);

  return (
    <div className="modern-control-panel">
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={enableLocalState ? localFormData : formData}
        renderers={renderers}
        onChange={handleChange}
        additionalErrors={[]}
      />
    </div>
  );
};

export default ModernControlPanel;

/**
 * Hook for using ModernControlPanel with local state management
 */
export function useModernControlPanel(
  initialFormData: QueryFormData,
  config?: ControlPanelConfig,
) {
  const [formData, setFormData] = useState(initialFormData);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const handleChange = useCallback((newFormData: QueryFormData) => {
    setFormData(newFormData);
  }, []);

  const handleValidationError = useCallback((errors: any[]) => {
    setValidationErrors(errors);
  }, []);

  return {
    formData,
    validationErrors,
    handleChange,
    handleValidationError,
    setFormData,
  };
}
