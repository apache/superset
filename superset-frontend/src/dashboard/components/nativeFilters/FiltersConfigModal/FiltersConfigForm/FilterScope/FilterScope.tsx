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

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { NativeFilterScope, styled } from '@superset-ui/core';
import { AntdForm } from 'src/components';
import ScopingTree from './ScopingTree';
import { getDefaultScopeValue } from './utils';

type FilterScopeProps = {
  pathToFormValue?: string[];
  updateFormValues: (values: any, triggerFormChange?: boolean) => void;
  formFilterScope?: NativeFilterScope;
  forceUpdate: Function;
  filterScope?: NativeFilterScope;
  chartId?: number;
  initiallyExcludedCharts?: number[];
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  & > * {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
  padding: 0px ${({ theme }) => theme.gridUnit * 4}px;
`;

const CleanFormItem = styled(AntdForm.Item)`
  margin-bottom: 0;
`;

const FilterScope: FC<FilterScopeProps> = ({
  pathToFormValue = [],
  formFilterScope,
  forceUpdate,
  filterScope,
  updateFormValues,
  chartId,
  initiallyExcludedCharts,
}) => {
  const initialFilterScope = useMemo(
    () => filterScope || getDefaultScopeValue(chartId, initiallyExcludedCharts),
    [chartId, filterScope, initiallyExcludedCharts],
  );
  const [hasScopeBeenModified, setHasScopeBeenModified] = useState(false);

  const onUpdateFormValues = useCallback(
    (formValues: any) => {
      updateFormValues(formValues);
      setHasScopeBeenModified(true);
    },
    [updateFormValues],
  );

  const updateScopes = useCallback(
    updatedFormValues => {
      if (hasScopeBeenModified) {
        return;
      }

      updateFormValues(updatedFormValues, false);
    },
    [hasScopeBeenModified, updateFormValues],
  );

  useEffect(() => {
    const updatedFormValues = {
      scope: initialFilterScope,
    };
    updateScopes(updatedFormValues);
  }, [initialFilterScope, updateScopes]);

  return (
    <Wrapper>
      <ScopingTree
        updateFormValues={onUpdateFormValues}
        initialScope={initialFilterScope}
        formScope={formFilterScope}
        forceUpdate={forceUpdate}
        chartId={chartId}
        initiallyExcludedCharts={initiallyExcludedCharts}
      />
      <CleanFormItem
        name={[...pathToFormValue, 'scope']}
        hidden
        initialValue={initialFilterScope}
      />
    </Wrapper>
  );
};

export default FilterScope;
