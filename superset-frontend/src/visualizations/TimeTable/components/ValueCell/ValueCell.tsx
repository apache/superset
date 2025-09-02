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
import { ReactElement, useMemo } from 'react';
import { colorFromBounds, calculateCellValue } from '../../utils';
import FormattedNumber from '../FormattedNumber';
import type { ColumnConfig, Entry } from '../../types';

interface ValueCellProps {
  valueField: string;
  column: ColumnConfig;
  reversedEntries: Entry[];
}

/**
 * Renders a value cell with different calculation types (time, contrib, avg)
 * and applies color coding based on bounds
 */
const ValueCell = ({
  valueField,
  column,
  reversedEntries,
}: ValueCellProps): ReactElement => {
  const { value: v, errorMsg } = useMemo(
    () => calculateCellValue(valueField, column, reversedEntries),
    [valueField, column, reversedEntries],
  );

  const color = colorFromBounds(v, column.bounds);

  return (
    <span
      key={column.key}
      data-value={v}
      css={theme =>
        color && {
          boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
          borderRight: `2px solid ${theme.colorBorderSecondary}`,
        }
      }
    >
      {errorMsg || (
        <span style={{ color: color || undefined }}>
          <FormattedNumber num={v} format={column.d3format} />
        </span>
      )}
    </span>
  );
};

export default ValueCell;
