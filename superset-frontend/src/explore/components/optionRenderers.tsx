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

import { styled } from '@apache-superset/core/theme';
import {
  MetricOption,
  ColumnOption,
  MetricOptionProps,
  ColumnOptionProps,
  ColumnTypeLabel,
} from '@superset-ui/chart-controls';
import { SQLPopover } from '@superset-ui/chart-controls/components/SQLPopover';
import { SavedFilter } from 'src/explore/components/DatasourcePanel/types';

const OptionContainer = styled.div`
  width: 100%;
  > span {
    display: flex;
    align-items: center;
  }

  .option-label {
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    & ~ i {
      margin-left: ${({ theme }) => theme.sizeUnit}px;
    }
  }
  .type-label {
    margin-right: ${({ theme }) => theme.sizeUnit * 3}px;
    width: ${({ theme }) => theme.sizeUnit * 7}px;
    display: inline-block;
    text-align: center;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }
`;

export const StyledMetricOption = (props: MetricOptionProps) => (
  <OptionContainer>
    <MetricOption {...props} />
  </OptionContainer>
);

export const StyledColumnOption = (props: ColumnOptionProps) => (
  <OptionContainer>
    <ColumnOption {...props} />
  </OptionContainer>
);

export const StyledSavedFilterOption = ({
  sqlFilter,
  showType = false,
}: {
  sqlFilter: SavedFilter;
  showType?: boolean;
}) => (
  <OptionContainer>
    <span>
      {showType && <ColumnTypeLabel type="expression" />}
      <span className="option-label">
        {sqlFilter.verbose_name || sqlFilter.filter_name}
      </span>
      {sqlFilter.expression ? (
        <SQLPopover sqlExpression={sqlFilter.expression} />
      ) : null}
    </span>
  </OptionContainer>
);
