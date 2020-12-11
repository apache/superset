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
import { styled } from '@superset-ui/core';
import { Radio as BaseRadio } from 'src/common/components';

const StyledRadio = styled(BaseRadio)`
  .ant-radio-inner {
    width: 18px;
    height: 18px;
    border-width: 2px;
    border-color: ${({ theme }) => theme.colors.grayscale.base};
  }

  .ant-radio.ant-radio-checked {
    .ant-radio-inner {
      background-color: ${({ theme }) => theme.colors.primary.dark1};
      border-color: ${({ theme }) => theme.colors.primary.dark1};
    }

    .ant-radio-inner::after {
      background-color: ${({ theme }) => theme.colors.grayscale.light5};
    }
  }

  .ant-radio:hover,
  .ant-radio:focus {
    .ant-radio-inner {
      border-color: ${({ theme }) => theme.colors.primary.dark1};
    }
  }
`;
const StyledGroup = styled(BaseRadio.Group)`
  font-size: inherit;
`;

export const Radio = Object.assign(StyledRadio, {
  Group: StyledGroup,
});
