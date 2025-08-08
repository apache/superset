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
import { useState } from 'react';
import { JsonForms } from '@jsonforms/react';
import {
  UISchemaElement,
  JsonSchema,
  VerticalLayout,
  HorizontalLayout,
  Categorization,
  GroupLayout,
} from '@jsonforms/core';
import { Collapse, Tabs } from 'antd';
import { styled } from '@superset-ui/core';

const { Panel } = Collapse;
const { TabPane } = Tabs;

// Styled components for consistent theming
const StyledCollapse = styled(Collapse)`
  margin-bottom: 16px;

  .ant-collapse-header {
    font-weight: bold;
    font-size: 14px;
  }
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin-bottom: 12px;
  }
`;

export interface JsonFormsControlPanelProps {
  schema: JsonSchema;
  uischema: UISchemaElement;
  data: any;
  onChange: (data: any) => void;
  renderers?: any[];
  cells?: any[];
}

/**
 * Custom renderer for collapsible sections using AntD Collapse
 */
const CollapsibleSectionRenderer = ({
  uischema,
  schema,
  enabled,
  renderers,
  cells,
  visible,
}: any) => {
  const group = uischema as GroupLayout;
  const defaultActiveKey = group.options?.expanded !== false ? ['0'] : [];

  return (
    <StyledCollapse defaultActiveKey={defaultActiveKey}>
      <Panel header={group.label} key="0">
        <JsonForms
          schema={schema}
          uischema={
            {
              type: 'VerticalLayout',
              elements: group.elements,
            } as UISchemaElement
          }
          data={{}}
          renderers={renderers}
          cells={cells}
        />
      </Panel>
    </StyledCollapse>
  );
};

/**
 * Custom renderer for tabbed sections using AntD Tabs
 */
const TabbedSectionRenderer = ({
  uischema,
  schema,
  enabled,
  renderers,
  cells,
}: any) => {
  const categorization = uischema as Categorization;

  return (
    <StyledTabs defaultActiveKey="0">
      {categorization.elements.map((category: any, index: number) => (
        <TabPane tab={category.label} key={String(index)}>
          <JsonForms
            schema={schema}
            uischema={
              {
                type: 'VerticalLayout',
                elements: category.elements,
              } as UISchemaElement
            }
            data={{}}
            renderers={renderers}
            cells={cells}
          />
        </TabPane>
      ))}
    </StyledTabs>
  );
};

// Tester functions for custom renderers
export const isCollapsibleSection = (uischema: UISchemaElement): boolean =>
  uischema.type === 'Group' && uischema.options?.collapsible === true;

export const isTabbedSection = (uischema: UISchemaElement): boolean =>
  uischema.type === 'Categorization';

// Custom renderers array (without material renderers which need to be installed separately)
export const customRenderers = [
  {
    tester: (uischema: UISchemaElement) =>
      isCollapsibleSection(uischema) ? 10 : -1,
    renderer: CollapsibleSectionRenderer,
  },
  {
    tester: (uischema: UISchemaElement) =>
      isTabbedSection(uischema) ? 10 : -1,
    renderer: TabbedSectionRenderer,
  },
];

/**
 * Main JsonForms-based control panel component
 */
export default function JsonFormsControlPanel({
  schema,
  uischema,
  data,
  onChange,
  renderers = customRenderers,
  cells,
}: JsonFormsControlPanelProps) {
  const [formData, setFormData] = useState(data);

  const handleChange = ({ data: newData, errors }: any) => {
    setFormData(newData);
    onChange(newData);
  };

  return (
    <JsonForms
      schema={schema}
      uischema={uischema}
      data={formData}
      renderers={renderers}
      cells={cells}
      onChange={handleChange}
    />
  );
}

/**
 * Helper function to create a vertical layout
 */
export const createVerticalLayout = (
  elements: UISchemaElement[],
): VerticalLayout => ({
  type: 'VerticalLayout',
  elements,
});

/**
 * Helper function to create a horizontal layout (for columns)
 */
export const createHorizontalLayout = (
  elements: UISchemaElement[],
): HorizontalLayout => ({
  type: 'HorizontalLayout',
  elements,
});

/**
 * Helper function to create a collapsible group
 */
export const createCollapsibleGroup = (
  label: string,
  elements: UISchemaElement[],
  expanded = true,
): GroupLayout => ({
  type: 'Group',
  label,
  elements,
  options: {
    collapsible: true,
    expanded,
  },
});

/**
 * Helper function to create a tabbed layout
 */
export const createTabbedLayout = (
  categories: Array<{ label: string; elements: UISchemaElement[] }>,
): Categorization => ({
  type: 'Categorization',
  label: '',
  elements: categories.map(cat => ({
    type: 'Category',
    label: cat.label,
    elements: cat.elements,
  })),
});

/**
 * Helper function to create a control reference
 */
export const createControl = (scope: string, label?: string): any => ({
  type: 'Control',
  scope,
  label,
});
