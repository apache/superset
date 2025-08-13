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
import { useCallback, ReactElement } from 'react';
import { Row, Col } from '@superset-ui/core/components';

type Control = ReactElement | null;

export default function ControlRow({ controls }: { controls: Control[] }) {
  const isHiddenControl = useCallback((control: Control) => {
    const props =
      control && 'shouldStash' in control.props
        ? control.props.children.props
        : control?.props;
    return props?.type === 'HiddenControl' || props?.isVisible === false;
  }, []);

  // Filter out hidden controls for column calculation
  const visibleControls = controls.filter(control => !isHiddenControl(control));

  // Calculate column span based on number of visible controls
  const colSpan =
    visibleControls.length > 0 ? Math.floor(24 / visibleControls.length) : 24;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {controls.map((control, i) => {
        if (isHiddenControl(control)) {
          // Hidden controls are rendered but not displayed
          return (
            <div key={i} style={{ display: 'none' }}>
              {control}
            </div>
          );
        }
        return (
          <Col key={i} span={colSpan} data-test="control-item">
            {control}
          </Col>
        );
      })}
    </Row>
  );
}
