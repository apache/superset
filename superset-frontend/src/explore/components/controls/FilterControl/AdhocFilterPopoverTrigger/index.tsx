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
  children?: React.ReactNode;
}

const AdhocFilterPopoverTrigger = ({
  adhocFilter,
  options,
  datasource,
  partitionColumn,
  sections,
  operators,
  onFilterEdit,
  requireSave,
  isControlledComponent,
  visible: propVisible,
  togglePopover: propTogglePopover,
  closePopover: propClosePopover,
  children,
}: AdhocFilterPopoverTriggerProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  const onPopoverResize = () => {
    // Force re-render to update popover position
    // This is equivalent to forceUpdate in class components
    setPopoverVisible(prevVisible => prevVisible);
  };

  const togglePopover = (visible: boolean) => {
    setPopoverVisible(visible);
  };

  const closePopover = () => {
    togglePopover(false);
  };

  // Determine which set of handlers to use based on whether this is a controlled component
  const { visible, togglePopoverFn, closePopoverFn } = isControlledComponent
    ? {
        visible: propVisible,
        togglePopoverFn: propTogglePopover,
        closePopoverFn: propClosePopover,
      }
    : {
        visible: popoverVisible,
        togglePopoverFn: togglePopover,
        closePopoverFn: closePopover,
      };

  const overlayContent = (
    <ExplorePopoverContent>
      <AdhocFilterEditPopover
        adhocFilter={adhocFilter}
        options={options}
        datasource={datasource}
        partitionColumn={partitionColumn}
        onResize={onPopoverResize}
        onClose={closePopoverFn}
        sections={sections}
        operators={operators}
        onChange={onFilterEdit}
        requireSave={requireSave}
      />
    </ExplorePopoverContent>
  );

  return (
    <ControlPopover
      trigger="click"
      content={overlayContent}
      defaultOpen={visible}
      open={visible}
      onOpenChange={togglePopoverFn}
      destroyTooltipOnHide
    >
      {children}
    </ControlPopover>
  );
};

export default AdhocFilterPopoverTrigger;
