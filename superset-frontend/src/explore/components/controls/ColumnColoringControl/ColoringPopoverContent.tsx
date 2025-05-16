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
import { useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { Form, FormItem } from 'src/components/Form';
import { Input } from 'src/components/Input';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import Button from 'src/components/Button';
import { HexColorPicker } from 'react-colorful';
import { ColumnColoringConfig } from './types';

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const rulesRequired = [{ required: true, message: t('Required') }];

export const ColoringPopoverContent = ({
  config,
  onChange,
  columns = [],
}: {
  config?: ColumnColoringConfig;
  onChange: (config: ColumnColoringConfig) => void;
  columns: { label: string; value: string }[];
}) => {
  const [selectedColumn, setSelectedColumn] = useState(
    config?.column || columns[0]?.value || '',
  );
  const [selectedColor, setSelectedColor] = useState(
    config?.colorScheme ?? '#FFFFFF',
  );

  const handleValidate = () => {
    onChange({ column: selectedColumn, colorScheme: selectedColor });
  };

  return (
    <Form requiredMark="optional" layout="vertical">
      <Row gutter={12}>
        <Col span={12}>
          <FormItem
            name="column"
            label={t('Column')}
            rules={rulesRequired}
            initialValue={config?.column || columns[0]?.value}
          >
            <Select
              ariaLabel={t('Select column')}
              options={columns}
              value={selectedColumn}
              onChange={(value: string | number) =>
                setSelectedColumn(value.toString())
              }
            />
          </FormItem>
          <FormItem name="color" label={t('Color')}>
            <div className="color-picker-wrapper">
              <Input
                type="text"
                value={selectedColor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSelectedColor(e.target.value)
                }
                placeholder="#FFFFFF"
                allowClear
              />
            </div>
          </FormItem>
        </Col>
        <Col span={12}>
          <HexColorPicker
            color={selectedColor}
            onChange={setSelectedColor}
            style={{ height: '133px' }}
          />
        </Col>
      </Row>
      <FormItem>
        <JustifyEnd>
          <Button buttonStyle="primary" onClick={handleValidate}>
            {t('Apply')}
          </Button>
        </JustifyEnd>
      </FormItem>
    </Form>
  );
};
