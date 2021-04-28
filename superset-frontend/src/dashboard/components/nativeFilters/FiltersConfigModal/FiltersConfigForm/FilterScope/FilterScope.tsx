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

import React, { FC } from 'react';
import { t, styled } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import { Form, Typography } from 'src/common/components';
import { Scope } from '../../../types';
import { Scoping } from './types';
import ScopingTree from './ScopingTree';
import { getDefaultScopeValue, isScopingAll } from './utils';

type FilterScopeProps = {
  pathToFormValue?: string[];
  updateFormValues: (values: any) => void;
  formScope?: Scope;
  forceUpdate: Function;
  scope?: Scope;
  formScoping?: Scoping;
  chartId?: number;
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  & > * {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const CleanFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

const FilterScope: FC<FilterScopeProps> = ({
  pathToFormValue = [],
  formScoping,
  formScope,
  forceUpdate,
  scope,
  updateFormValues,
  chartId,
}) => {
  const initialScope = scope || getDefaultScopeValue(chartId);
  const initialScoping = isScopingAll(initialScope, chartId)
    ? Scoping.all
    : Scoping.specific;

  return (
    <Wrapper>
      <Typography.Title level={5}>{t('Scoping')}</Typography.Title>
      <CleanFormItem
        name={[...pathToFormValue, 'scoping']}
        initialValue={initialScoping}
      >
        <Radio.Group
          onChange={({ target: { value } }) => {
            if (value === Scoping.all) {
              const scope = getDefaultScopeValue(chartId);
              updateFormValues({
                scope,
              });
            }
            forceUpdate();
          }}
        >
          <Radio value={Scoping.all}>{t('Apply to all panels')}</Radio>
          <Radio value={Scoping.specific}>
            {t('Apply to specific panels')}
          </Radio>
        </Radio.Group>
      </CleanFormItem>
      <Typography.Text type="secondary">
        {(formScoping ?? initialScoping) === Scoping.specific
          ? t('Only selected panels will be affected by this filter')
          : t('All panels with this column will be affected by this filter')}
      </Typography.Text>
      {(formScoping ?? initialScoping) === Scoping.specific && (
        <ScopingTree
          updateFormValues={updateFormValues}
          initialScope={initialScope}
          formScope={formScope}
          forceUpdate={forceUpdate}
          chartId={chartId}
        />
      )}
      <CleanFormItem
        name={[...pathToFormValue, 'scope']}
        hidden
        initialValue={initialScope}
      />
    </Wrapper>
  );
};

export default FilterScope;
