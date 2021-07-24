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

import { SearchOutlined } from '@ant-design/icons';
import React, { FC } from 'react';
import { getFilterValueForDisplay } from 'src/dashboard/components/nativeFilters/FilterBar/FilterSets/utils';
import {
  FilterIndicatorText,
  FilterValue,
  Item,
  ItemIcon,
  Title,
} from 'src/dashboard/components/FiltersBadge/Styles';
import { Indicator } from 'src/dashboard/components/FiltersBadge/selectors';

export interface IndicatorProps {
  indicator: Indicator;
  onClick?: (path: string[]) => void;
  text?: string;
}

const FilterIndicator: FC<IndicatorProps> = ({
  indicator: { column, name, value, path = [] },
  onClick = () => {},
  text,
}) => {
  const resultValue = getFilterValueForDisplay(value);
  return (
    <>
      <Item onClick={() => onClick([...path, `LABEL-${column}`])}>
        <Title bold>
          <ItemIcon>
            <SearchOutlined />
          </ItemIcon>
          {name}
          {resultValue ? ': ' : ''}
        </Title>
        <FilterValue>{resultValue}</FilterValue>
      </Item>
      {text && <FilterIndicatorText>{text}</FilterIndicatorText>}
    </>
  );
};

export default FilterIndicator;
