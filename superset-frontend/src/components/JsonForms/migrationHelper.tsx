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

import { ReactElement } from 'react';
import {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  ControlSetItem,
  ControlSetRow,
  ControlState,
} from '@superset-ui/chart-controls';
import { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import ModernControlPanel from './ModernControlPanel';
import { generateSchemaFromControlPanel } from './schemaGenerator';

/**
 * Migration helper for incrementally converting control panels to JSON Forms
 */

export interface MigrationOptions {
  // Which sections to migrate (by label)
  sectionsToMigrate?: string[];
  // Whether to keep original controls alongside new ones
  keepOriginal?: boolean;
  // Custom schema overrides
  schemaOverrides?: Partial<JsonSchema7>;
  // Custom UI schema overrides
  uischemaOverrides?: Partial<UISchemaElement>;
  // Enable feature flag for migration
  enableMigration?: boolean;
}

/**
 * Wrap existing control panel config to use JSON Forms incrementally
 */
export function migrateControlPanel(
  config: ControlPanelConfig,
  options: MigrationOptions = {},
): ControlPanelConfig {
  const {
    sectionsToMigrate = [],
    keepOriginal = false,
    schemaOverrides = {},
    uischemaOverrides = {},
    enableMigration = true,
  } = options;

  if (!enableMigration) {
    return config;
  }

  const migratedSections: ControlPanelSectionConfig[] = [];
  const unmigrateSections: ControlPanelSectionConfig[] = [];

  config.controlPanelSections?.forEach(section => {
    if (!section) return;
    const sectionLabel = section.label as string;
    const shouldMigrate =
      sectionsToMigrate.length === 0 ||
      sectionsToMigrate.includes(sectionLabel);

    if (shouldMigrate) {
      // Create a modernized version of this section
      const modernSection: ControlPanelSectionConfig = {
        ...section,
        label: keepOriginal ? `${sectionLabel} (Modern)` : sectionLabel,
        controlSetRows: [
          [
            createModernControlPanelElement(
              {
                controlPanelSections: [section],
              },
              schemaOverrides,
              uischemaOverrides,
            ),
          ],
        ],
      };
      migratedSections.push(modernSection);

      if (keepOriginal) {
        unmigrateSections.push({
          ...section,
          label: `${sectionLabel} (Legacy)`,
        });
      }
    } else {
      unmigrateSections.push(section);
    }
  });

  return {
    ...config,
    controlPanelSections: [...migratedSections, ...unmigrateSections],
  };
}

/**
 * Create a ModernControlPanel element for embedding in traditional control panels
 */
function createModernControlPanelElement(
  config: ControlPanelConfig,
  schemaOverrides?: Partial<JsonSchema7>,
  uischemaOverrides?: Partial<UISchemaElement>,
): ReactElement {
  return (
    <ModernControlPanel
      key="modern-panel"
      config={config}
      formData={{ datasource: '', viz_type: '' }}
      onChange={formData => {
        console.log('Modern panel data:', formData);
      }}
      enableLocalState
    />
  );
}

/**
 * Progressively migrate individual controls within a section
 */
export function migrateControlsInSection(
  section: ControlPanelSectionConfig,
  controlsToMigrate: string[],
  controls: Record<string, ControlState> = {},
): ControlPanelSectionConfig {
  const modernizedRows: ControlSetRow[] = [];

  section.controlSetRows?.forEach(row => {
    const modernizedRow: ControlSetItem[] = [];

    row.forEach(item => {
      if (!item) {
        modernizedRow.push(item);
        return;
      }

      const controlName =
        typeof item === 'string' ? item : 'name' in item ? item.name : null;

      if (controlName && controlsToMigrate.includes(controlName)) {
        // Replace with modern version
        const schema = generateSchemaForControl(
          controlName,
          controls[controlName],
        );
        const uischema: UISchemaElement = {
          type: 'Control',
          scope: `#/properties/${controlName}`,
        };

        modernizedRow.push(
          <ModernControlPanel
            key={controlName}
            schema={schema}
            uischema={uischema}
            formData={{
              [controlName]: controls[controlName]?.value,
              datasource: '',
              viz_type: '',
            }}
            onChange={() => {}}
            enableLocalState={false}
          />,
        );
      } else {
        // Keep original
        modernizedRow.push(item);
      }
    });

    modernizedRows.push(modernizedRow);
  });

  return {
    ...section,
    controlSetRows: modernizedRows,
  };
}

/**
 * Helper to generate schema for a single control
 */
function generateSchemaForControl(
  controlName: string,
  control: ControlState,
): JsonSchema7 {
  const { schema } = generateSchemaFromControlPanel(
    {
      controlPanelSections: [
        {
          label: 'temp',
          controlSetRows: [[controlName as unknown as ControlSetItem]],
        },
      ],
    },
    { [controlName]: control },
  );

  return schema;
}

/**
 * Feature flag helper for gradual rollout
 */
export function shouldUseMigration(
  vizType: string,
  featureFlags: Record<string, boolean> = {},
): boolean {
  // Check global flag
  if (featureFlags.USE_JSON_FORMS_MIGRATION === false) {
    return false;
  }

  // Check viz-specific flag
  const vizSpecificFlag = `USE_JSON_FORMS_${vizType.toUpperCase()}`;
  if (vizSpecificFlag in featureFlags) {
    return featureFlags[vizSpecificFlag];
  }

  // Default based on allowlist
  const migratedVizTypes = ['big_number', 'big_number_total'];
  return migratedVizTypes.includes(vizType);
}

/**
 * HOC to wrap control panel configs with migration support
 */
export function withMigration(
  config: ControlPanelConfig,
  options?: MigrationOptions,
): ControlPanelConfig {
  return {
    ...config,
    // Override the sections getter to return migrated version
    get controlPanelSections() {
      const migrated = migrateControlPanel(
        { ...config, controlPanelSections: config.controlPanelSections },
        options,
      );
      return migrated.controlPanelSections;
    },
  };
}
