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
import React from 'react';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import Popover from 'src/common/components/Popover';
import AdhocFilterEditPopover from './AdhocFilterEditPopover';
import AdhocFilter from '../AdhocFilter';
import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';

interface AdhocFilterPopoverTriggerProps {
  adhocFilter: AdhocFilter;
  options:
    | typeof columnType[]
    | { saved_metric_name: string }[]
    | typeof adhocMetricType[];
  datasource: Record<string, any>;
  onFilterEdit: () => void;
  partitionColumn?: string;
  createNew?: boolean;
}

interface AdhocFilterPopoverTriggerState {
  popoverVisible: boolean;
}

class AdhocFilterPopoverTrigger extends React.PureComponent<
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
    const { adhocFilter } = this.props;
    const overlayContent = (
      <AdhocFilterEditPopover
        adhocFilter={adhocFilter}
        options={this.props.options}
        datasource={this.props.datasource}
        partitionColumn={this.props.partitionColumn}
        onResize={this.onPopoverResize}
        onClose={this.closePopover}
        onChange={this.props.onFilterEdit}
      />
    );

    return (
      <>
        {adhocFilter.isExtra && (
          <InfoTooltipWithTrigger
            icon="exclamation-triangle"
            placement="top"
            className="m-r-5 text-muted"
            tooltip={t(`
                This filter was inherited from the dashboard's context.
                It won't be saved when saving the chart.
              `)}
          />
        )}
        <Popover
          placement="right"
          trigger="click"
          content={overlayContent}
          defaultVisible={this.state.popoverVisible}
          visible={this.state.popoverVisible}
          onVisibleChange={this.togglePopover}
          overlayStyle={{ zIndex: 1 }}
          destroyTooltipOnHide={this.props.createNew}
        >
          {this.props.children}
        </Popover>
      </>
    );
  }
}

export default AdhocFilterPopoverTrigger;
