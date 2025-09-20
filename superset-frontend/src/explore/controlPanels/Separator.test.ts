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
import type {
  ControlPanelState,
  ControlState,
} from '@superset-ui/chart-controls';
import Separator from './Separator';

function getCodeControlMapStateToProps() {
  const sections =
    (Separator.controlPanelSections as unknown as Array<{
      controlSetRows?: Array<
        Array<{
          name?: string;
          config?: {
            mapStateToProps?: (s: Partial<ControlPanelState>) => {
              language: string;
            };
          };
        }>
      >;
    }>) || [];

  const codeControl = sections
    .flatMap(s => s.controlSetRows || [])
    .flatMap(r => r)
    .find(i => i?.name === 'code') as unknown as {
    config: {
      mapStateToProps: (s: Partial<ControlPanelState>) => { language: string };
    };
  };

  if (!codeControl || !codeControl.config?.mapStateToProps) {
    throw new Error('Code control configuration not found');
  }
  return codeControl.config.mapStateToProps;
}

describe('Separator control panel config', () => {
  it('defaults language to markdown when markup_type is missing', () => {
    const mapStateToProps = getCodeControlMapStateToProps();
    const state: Partial<ControlPanelState> = {};
    const result = mapStateToProps(state);
    expect(result.language).toBe('markdown');
  });

  it('uses markup_type value when provided', () => {
    const mapStateToProps = getCodeControlMapStateToProps();
    const state: Partial<ControlPanelState> = {
      controls: {
        // minimal mock for the control used in mapStateToProps
        markup_type: { value: 'html' } as Partial<
          ControlState<'SelectControl'>
        > as ControlState<'SelectControl'>,
      },
    };
    const result = mapStateToProps(state);
    expect(result.language).toBe('html');
  });
});
