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
import { Form as AntdForm } from 'antd-v5';
import { FormProps } from 'antd-v5/es/form';
import { styled } from '@superset-ui/core';

const StyledForm = styled(AntdForm)`
  &.antd5-form label {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
  .antd5-form-item {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  }
`;

function Form(props: FormProps) {
  return <StyledForm {...props} />;
}

export default Object.assign(Form, {
  useForm: AntdForm.useForm,
  Item: AntdForm.Item,
  List: AntdForm.List,
  ErrorList: AntdForm.ErrorList,
  Provider: AntdForm.Provider,
});

export type { FormInstance } from 'antd-v5/es/form';

export type { FormProps };
