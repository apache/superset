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
import React, { useCallback, useMemo, useState } from 'react';
import { ColumnMeta } from '@superset-ui/chart-controls';
import Popover from 'src/components/Popover';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import ColumnSelectPopover from './ColumnSelectPopover';

interface ColumnSelectPopoverTriggerProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta;
  onColumnEdit: (editedColumn: ColumnMeta) => void;
  children: React.ReactNode;
}

const ColumnSelectPopoverTrigger = ({
  columns,
  editedColumn,
  onColumnEdit,
  children,
}: ColumnSelectPopoverTriggerProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  const togglePopover = useCallback((visible: boolean) => {
    setPopoverVisible(visible);
  }, []);

  const closePopover = useCallback(() => {
    setPopoverVisible(false);
  }, []);

  const overlayContent = useMemo(
    () => (
      <ExplorePopoverContent>
        <ColumnSelectPopover
          editedColumn={editedColumn}
          columns={columns}
          onClose={closePopover}
          onChange={onColumnEdit}
        />
      </ExplorePopoverContent>
    ),
    [closePopover, columns, editedColumn, onColumnEdit],
  );

  return (
    <Popover
      placement="right"
      trigger="click"
      content={overlayContent}
      defaultVisible={popoverVisible}
      visible={popoverVisible}
      onVisibleChange={togglePopover}
      destroyTooltipOnHide
    >
      {children}
    </Popover>
  );
};

export default ColumnSelectPopoverTrigger;
