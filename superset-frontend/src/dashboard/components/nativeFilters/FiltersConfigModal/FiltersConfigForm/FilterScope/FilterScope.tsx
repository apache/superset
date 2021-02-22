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
import { Radio } from 'src/common/components/Radio';
import { Form, Typography, Space, FormInstance } from 'src/common/components';
import { NativeFiltersForm } from '../../types';
import { Filter } from '../../../types';
import { Scoping } from './types';
import ScopingTree from './ScopingTree';
import { setFilterFieldValues, useForceUpdate } from '../utils';
import { getDefaultScopeValue, isScopingAll } from './utils';

type FilterScopeProps = {
  filterId: string;
  filterToEdit?: Filter;
  form: FormInstance<NativeFiltersForm>;
};

const CleanFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

const FilterScope: FC<FilterScopeProps> = ({
  filterId,
  filterToEdit,
  form,
}) => {
  const formFilter = form.getFieldValue('filters')?.[filterId];
  const initialScope = filterToEdit?.scope || getDefaultScopeValue();

  const scoping = isScopingAll(initialScope) ? Scoping.all : Scoping.specific;

  const forceUpdate = useForceUpdate();

  return (
    <Space direction="vertical">
      <CleanFormItem
        name={['filters', filterId, 'scope']}
        hidden
        initialValue={initialScope}
      />
      <Typography.Title level={5}>{t('Scoping')}</Typography.Title>
      <CleanFormItem
        name={['filters', filterId, 'scoping']}
        initialValue={scoping}
      >
        <Radio.Group
          onChange={({ target: { value } }) => {
            if (value === Scoping.all) {
              setFilterFieldValues(form, filterId, {
                scope: getDefaultScopeValue(),
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
        {formFilter?.scoping === Scoping.specific
          ? t('Only selected panels will be affected by this filter')
          : t('All panels with this column will be affected by this filter')}
      </Typography.Text>
      {formFilter?.scoping === Scoping.specific && (
        <ScopingTree
          initialScope={initialScope}
          form={form}
          filterId={filterId}
        />
      )}
    </Space>
  );
};

export default FilterScope;
