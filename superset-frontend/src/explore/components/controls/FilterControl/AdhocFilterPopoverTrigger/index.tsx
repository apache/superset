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
import { PureComponent } from 'react';
import { OptionSortType } from 'src/explore/types';
import AdhocFilterEditPopover from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopover';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { Operators } from 'src/explore/constants';
import ControlPopover from '../../ControlPopover/ControlPopover';

interface AdhocFilterPopoverTriggerProps {
  sections?: string[];
  operators?: Operators[];
  adhocFilter: AdhocFilter;
  options: OptionSortType[];
  datasource: Record<string, any>;
  onFilterEdit: (editedFilter: AdhocFilter) => void;
  partitionColumn?: string;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  requireSave?: boolean;
}

interface AdhocFilterPopoverTriggerState {
  popoverVisible: boolean;
}

class AdhocFilterPopoverTrigger extends PureComponent<
  AdhocFilterPopoverTriggerProps,
  AdhocFilterPopoverTriggerState
> {
  constructor(props: AdhocFilterPopoverTriggerProps) {
    super(props);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.closePopover = this.closePopover.bind(this);
    this.togglePopover = this.togglePopover.bind(this);
    this.state = {
      popoverVisible: false,
    };
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  closePopover() {
    this.togglePopover(false);
  }

  togglePopover(visible: boolean) {
    this.setState({
      popoverVisible: visible,
    });
  }

  render() {
    const { adhocFilter, isControlledComponent } = this.props;

    const { visible, togglePopover, closePopover } = isControlledComponent
      ? {
          visible: this.props.visible,
          togglePopover: this.props.togglePopover,
          closePopover: this.props.closePopover,
        }
      : {
          visible: this.state.popoverVisible,
          togglePopover: this.togglePopover,
          closePopover: this.closePopover,
        };
    const overlayContent = (
      <ExplorePopoverContent>
        <AdhocFilterEditPopover
          adhocFilter={adhocFilter}
          options={this.props.options}
          datasource={this.props.datasource}
          partitionColumn={this.props.partitionColumn}
          onResize={this.onPopoverResize}
          onClose={closePopover}
          sections={this.props.sections}
          operators={this.props.operators}
          onChange={this.props.onFilterEdit}
          requireSave={this.props.requireSave}
        />
      </ExplorePopoverContent>
    );

    return (
      <ControlPopover
        trigger="click"
        content={overlayContent}
        defaultVisible={visible}
        visible={visible}
        onVisibleChange={togglePopover}
        destroyTooltipOnHide
      >
        {this.props.children}
      </ControlPopover>
    );
  }
}

export default AdhocFilterPopoverTrigger;
