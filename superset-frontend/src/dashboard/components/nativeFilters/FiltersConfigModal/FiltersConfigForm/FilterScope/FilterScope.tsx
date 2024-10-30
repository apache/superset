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

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeFilterScope, styled, t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import { AntdForm, Typography } from 'src/components';
import { ScopingType } from './types';
import ScopingTree from './ScopingTree';
import { getDefaultScopeValue, isScopingAll } from './utils';

type FilterScopeProps = {
  pathToFormValue?: string[];
  updateFormValues: (values: any, triggerFormChange?: boolean) => void;
  formFilterScope?: NativeFilterScope;
  forceUpdate: Function;
  filterScope?: NativeFilterScope;
  formScopingType?: ScopingType;
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
  formScopingType,
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
  const lastSpecificScope = useRef(initialFilterScope);
  const initialScopingType = useMemo(
    () =>
      isScopingAll(initialFilterScope, chartId)
        ? ScopingType.All
        : ScopingType.Specific,
    [chartId, initialFilterScope],
  );
  const [hasScopeBeenModified, setHasScopeBeenModified] = useState(false);

  const onUpdateFormValues = useCallback(
    (formValues: any) => {
      if (formScopingType === ScopingType.Specific) {
        lastSpecificScope.current = formValues.scope;
      }
      updateFormValues(formValues);
      setHasScopeBeenModified(true);
    },
    [formScopingType, updateFormValues],
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
      scoping: initialScopingType,
    };
    updateScopes(updatedFormValues);
  }, [initialFilterScope, initialScopingType, updateScopes]);

  return (
    <Wrapper>
      <CleanFormItem
        name={[...pathToFormValue, 'scoping']}
        initialValue={initialScopingType}
      >
        <Radio.Group
          onChange={({ target: { value } }) => {
            const scope =
              value === ScopingType.All
                ? getDefaultScopeValue(chartId)
                : lastSpecificScope.current;
            updateFormValues({ scope });
            setHasScopeBeenModified(true);
            forceUpdate();
          }}
        >
          <Radio value={ScopingType.All}>{t('Apply to all panels')}</Radio>
          <Radio value={ScopingType.Specific}>
            {t('Apply to specific panels')}
          </Radio>
        </Radio.Group>
      </CleanFormItem>
      <Typography.Text type="secondary">
        {(formScopingType ?? initialScopingType) === ScopingType.Specific
          ? t('Only selected panels will be affected by this filter')
          : t('All panels with this column will be affected by this filter')}
      </Typography.Text>
      {(formScopingType ?? initialScopingType) === ScopingType.Specific && (
        <ScopingTree
          updateFormValues={onUpdateFormValues}
          initialScope={initialFilterScope}
          formScope={formFilterScope}
          forceUpdate={forceUpdate}
          chartId={chartId}
          initiallyExcludedCharts={initiallyExcludedCharts}
        />
      )}
      <CleanFormItem
        name={[...pathToFormValue, 'scope']}
        hidden
        initialValue={initialFilterScope}
      />
    </Wrapper>
  );
};

export default FilterScope;
