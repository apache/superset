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
import { useEffect, useState, Dispatch } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { FormItem } from 'src/components/Form';
import { Select } from 'src/components';
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import {
  DatasetObject,
  FactDimensionObject,
  DSReducerActionType,
  DatasetActionType,
} from '../types';

const TABLE_TYPE_OPTIONS = [
  { value: 'physical', label: t('Physical') },
  { value: 'view', label: t('View') },
  { value: 'fact', label: t('Fact') },
  { value: 'dimension', label: t('Dimension') },
];

export default function RightPanel({
  dataset,
  setDataset,
}: {
  dataset: Partial<DatasetObject> | null;
  setDataset: Dispatch<DSReducerActionType>;
}) {
  const [dimensionOptions, setDimensionOptions] = useState<
    Array<{ value: number; label: string }>
  >([]);

  useEffect(() => {
    // fetch all dimension datasets
    const filters = [{ col: 'table_type', opr: 'eq', value: 'dimension' }];
    const query = rison.encode({ filters });
    SupersetClient.get({ endpoint: `/api/v1/dataset/?q=${query}` }).then(
      ({ json }) => {
        setDimensionOptions(
          json.result.map((r: any) => ({
            value: r.id,
            label: r.table_name,
          })),
        );
      },
    );
  }, []);

  const onChangeTableType = (value: string) => {
    setDataset({
      type: DatasetActionType.ChangeDataset,
      payload: { name: 'table_type', value },
    });
  };

  const updateFactDimensions = (fds: FactDimensionObject[]) => {
    setDataset({
      type: DatasetActionType.ChangeDataset,
      payload: { name: 'fact_dimensions', value: fds },
    });
  };

  const addDimension = () => {
    const fds = dataset?.fact_dimensions || [];
    updateFactDimensions([
      ...fds,
      { dimension_table_id: 0, fact_fk: '', dimension_pk: '' },
    ]);
  };

  const onUpdateDimension = (
    index: number,
    fd: Partial<FactDimensionObject>,
  ) => {
    const fds = (dataset?.fact_dimensions || []).slice();
    fds[index] = { ...fds[index], ...fd } as FactDimensionObject;
    updateFactDimensions(fds);
  };

  const onRemoveDimension = (index: number) => {
    const fds = (dataset?.fact_dimensions || []).filter((_, i) => i !== index);
    updateFactDimensions(fds);
  };

  return (
    <div>
      <FormItem label={t('Table Type')}>
        <Select
          value={dataset?.table_type || 'physical'}
          onChange={onChangeTableType}
          data-test="table-type-select"
        >
          {TABLE_TYPE_OPTIONS.map(opt => (
            <Select.Option key={opt.value} value={opt.value}>
              {opt.label}
            </Select.Option>
          ))}
        </Select>
      </FormItem>
      {dataset?.table_type === 'fact' && (
        <div>
          <div>{t('Dimensions')}</div>
          {(dataset.fact_dimensions || []).map((fd, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px' }}>
              <FormItem label={t('Dimension Table')}>
                <Select
                  value={fd.dimension_table_id}
                  onChange={value =>
                    onUpdateDimension(idx, { dimension_table_id: value })
                  }
                >
                  {dimensionOptions.map(opt => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label={t('Fact FK')}>
                <Input
                  value={fd.fact_fk}
                  onChange={e =>
                    onUpdateDimension(idx, { fact_fk: e.target.value })
                  }
                />
              </FormItem>
              <FormItem label={t('Dimension PK')}>
                <Input
                  value={fd.dimension_pk}
                  onChange={e =>
                    onUpdateDimension(idx, { dimension_pk: e.target.value })
                  }
                />
              </FormItem>
              <Button onClick={() => onRemoveDimension(idx)}>
                {t('Remove')}
              </Button>
            </div>
          ))}
          <Button onClick={addDimension}>{t('Add Dimension')}</Button>
        </div>
      )}
    </div>
  );
}
