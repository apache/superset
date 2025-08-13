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
import { ReactNode, FC } from 'react';
import { Row, Col, Collapse } from '@superset-ui/core/components';

/**
 * Props for control panel sections
 */
export interface ControlSectionProps {
  label?: ReactNode;
  description?: ReactNode;
  expanded?: boolean;
  children: ReactNode;
}

/**
 * A collapsible section in the control panel
 */
export const ControlSection: FC<ControlSectionProps> = ({
  label,
  description,
  expanded = true,
  children,
}) => {
  if (!label) {
    // No label means no collapsible wrapper
    return <>{children}</>;
  }

  return (
    <Collapse defaultActiveKey={expanded ? ['1'] : []} ghost>
      <Collapse.Panel
        header={
          <span>
            {label}
            {description && (
              <span style={{ marginLeft: 8, fontSize: '0.85em', opacity: 0.7 }}>
                {description}
              </span>
            )}
          </span>
        }
        key="1"
      >
        {children}
      </Collapse.Panel>
    </Collapse>
  );
};

/**
 * Props for control row - uses Ant Design grid
 */
export interface ControlRowProps {
  children: ReactNode;
  gutter?: number | [number, number];
}

/**
 * A row of controls using Ant Design's grid system
 * Automatically distributes controls evenly across columns
 */
export const ControlPanelRow: FC<ControlRowProps> = ({
  children,
  gutter = [16, 16],
}) => {
  const childArray = Array.isArray(children) ? children : [children];
  const validChildren = childArray.filter(
    child => child !== null && child !== undefined,
  );
  const colSpan =
    validChildren.length > 0 ? Math.floor(24 / validChildren.length) : 24;

  return (
    <Row gutter={gutter} style={{ marginBottom: 16 }}>
      {validChildren.map((child, index) => (
        <Col key={index} span={colSpan}>
          {child}
        </Col>
      ))}
    </Row>
  );
};

/**
 * Props for the main control panel layout
 */
export interface ControlPanelLayoutProps {
  children: ReactNode;
}

/**
 * Main control panel layout container
 */
export const ControlPanelLayout: FC<ControlPanelLayoutProps> = ({
  children,
}) => (
  <div className="control-panel-layout" style={{ padding: '16px 0' }}>
    {children}
  </div>
);

/**
 * Helper function to create a full-width single control row
 */
export const SingleControlRow: FC<{ children: ReactNode }> = ({ children }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
    <Col span={24}>{children}</Col>
  </Row>
);

/**
 * Helper function to create a two-column control row
 */
export const TwoColumnRow: FC<{ left: ReactNode; right: ReactNode }> = ({
  left,
  right,
}) => (
  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
    <Col span={12}>{left}</Col>
    <Col span={12}>{right}</Col>
  </Row>
);

/**
 * Helper function to create a three-column control row
 */
export const ThreeColumnRow: FC<{
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}> = ({ left, center, right }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
    <Col span={8}>{left}</Col>
    <Col span={8}>{center}</Col>
    <Col span={8}>{right}</Col>
  </Row>
);
