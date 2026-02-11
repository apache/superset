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
import { useState, useCallback, type ReactNode } from 'react';
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
  children?: ReactNode;
}

function AdhocFilterPopoverTrigger({
  sections,
  operators,
  adhocFilter,
  options,
  datasource,
  onFilterEdit,
  partitionColumn,
  isControlledComponent,
  visible: propsVisible,
  togglePopover: propsTogglePopover,
  closePopover: propsClosePopover,
  requireSave,
  children,
}: AdhocFilterPopoverTriggerProps) {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [, forceUpdate] = useState({});

  const onPopoverResize = useCallback(() => {
    forceUpdate({});
  }, []);

  const internalClosePopover = useCallback(() => {
    setPopoverVisible(false);
  }, []);

  const internalTogglePopover = useCallback((visible: boolean) => {
    setPopoverVisible(visible);
  }, []);

  const { visible, togglePopover, closePopover } = isControlledComponent
    ? {
        visible: propsVisible,
        togglePopover: propsTogglePopover,
        closePopover: propsClosePopover,
      }
    : {
        visible: popoverVisible,
        togglePopover: internalTogglePopover,
        closePopover: internalClosePopover,
      };

  const overlayContent = (
    <ExplorePopoverContent>
      <AdhocFilterEditPopover
        adhocFilter={adhocFilter}
        options={options}
        datasource={datasource}
        partitionColumn={partitionColumn}
        onResize={onPopoverResize}
        onClose={closePopover ?? (() => {})}
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
      onOpenChange={togglePopover}
      destroyTooltipOnHide
    >
      {children}
    </ControlPopover>
  );
}

export default AdhocFilterPopoverTrigger;
