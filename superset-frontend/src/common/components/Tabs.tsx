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
import styled from '@superset-ui/style';
import { Tabs as BaseTabs } from 'src/common/components';

const Tabs = styled(BaseTabs)`
  margin-top: -18px;

  .ant-tabs-nav-list {
    width: 100%;
  }

  .ant-tabs-tab {
    flex: 1 1 auto;
    width: 0;

    &.ant-tabs-tab-active .ant-tabs-tab-btn {
      color: inherit;
    }
  }

  .ant-tabs-tab-btn {
    flex: 1 1 auto;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    text-align: center;
    text-transform: uppercase;

    .required {
      margin-left: ${({ theme }) => theme.gridUnit / 2}px;
      color: ${({ theme }) => theme.colors.error.base};
    }
  }

  .ant-tabs-ink-bar {
    background: ${({ theme }) => theme.colors.secondary.base};
  }
`;

export default Tabs;
