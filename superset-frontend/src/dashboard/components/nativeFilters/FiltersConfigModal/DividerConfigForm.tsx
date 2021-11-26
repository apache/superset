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
import React from 'react';
import { FormItem } from 'src/components/Form';
import { Input, TextArea } from 'src/common/components';
import { styled, t } from '@superset-ui/core';
import { NativeFilterType } from '../types';

interface Props {
  componentId: string;
  divider?: {
    title: string;
    description: string;
  };
}
const Container = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 4}px;
  `}
`;

const DividerConfigForm: React.FC<Props> = ({ componentId, divider }) => (
  <Container>
    <FormItem
      initialValue={divider ? divider.title : ''}
      label={t('Title')}
      name={['filters', componentId, 'title']}
      rules={[
        { required: true, message: t('Title is required'), whitespace: true },
      ]}
    >
      <Input />
    </FormItem>
    <FormItem
      initialValue={divider ? divider.description : ''}
      label={t('Description')}
      name={['filters', componentId, 'description']}
    >
      <TextArea rows={4} />
    </FormItem>
    <FormItem
      hidden
      name={['filters', componentId, 'type']}
      initialValue={NativeFilterType.DIVIDER}
    />
  </Container>
);

export default DividerConfigForm;
