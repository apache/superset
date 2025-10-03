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
import { useState, useCallback, useLayoutEffect } from 'react';
import getScrollBarSize from '../../../DataTable/utils/getScrollBarSize';

interface TableSize {
  width: number;
  height: number;
}

export interface UseTableResizeProps {
  width: number;
  height: number;
}

export function useTableResize({ width, height }: UseTableResizeProps) {
  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });

  const handleSizeChange = useCallback(
    ({ width: w, height: h }: { width: number; height: number }) => {
      setTableSize({ width: w, height: h });
    },
    [],
  );

  useLayoutEffect(() => {
    const scrollBarSize = getScrollBarSize();
    const { width: tableWidth, height: tableHeight } = tableSize;

    if (
      width - tableWidth > scrollBarSize ||
      height - tableHeight > scrollBarSize
    ) {
      handleSizeChange({
        width: width - scrollBarSize,
        height: height - scrollBarSize,
      });
    } else if (
      tableWidth - width > scrollBarSize ||
      tableHeight - height > scrollBarSize
    ) {
      handleSizeChange({
        width,
        height,
      });
    }
  }, [width, height, handleSizeChange, tableSize]);

  return {
    tableSize,
    handleSizeChange,
  };
}
