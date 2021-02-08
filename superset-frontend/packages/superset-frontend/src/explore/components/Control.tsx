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
import React, { ReactNode } from 'react';
import { ControlType } from '@superset-ui/chart-controls';
import { JsonValue, QueryFormData } from '@superset-ui/core';
import { ExploreActions } from '../actions/exploreActions';
import controlMap from './controls';

import './Control.less';

export type ControlProps = {
  // the actual action dispatcher (via bindActionCreators) has identical
  // signature to the original action factory.
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  type: ControlType;
  label?: ReactNode;
  name: string;
  description?: ReactNode;
  tooltipOnClick?: () => ReactNode;
  places?: number;
  rightNode?: ReactNode;
  formData?: QueryFormData | null;
  value?: JsonValue;
  validationErrors?: any[];
  hidden?: boolean;
  renderTrigger?: boolean;
};

export default class Control extends React.PureComponent<
  ControlProps,
  { hovered: boolean }
> {
  onMouseEnter: () => void;

  onMouseLeave: () => void;

  constructor(props: ControlProps) {
    super(props);
    this.state = { hovered: false };
    this.onChange = this.onChange.bind(this);
    this.onMouseEnter = this.setHover.bind(this, true);
    this.onMouseLeave = this.setHover.bind(this, false);
  }

  onChange(value: any, errors: any[]) {
    this.props.actions.setControlValue(this.props.name, value, errors);
  }

  setHover(hovered: boolean) {
    this.setState({ hovered });
  }

  render() {
    const { type, hidden } = this.props;
    if (!type) return null;
    const ControlComponent = typeof type === 'string' ? controlMap[type] : type;
    return (
      <div
        className="Control"
        data-test={this.props.name}
        style={hidden ? { display: 'none' } : undefined}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <ControlComponent
          onChange={this.onChange}
          hovered={this.state.hovered}
          {...this.props}
        />
      </div>
    );
  }
}
