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
import styled from '@emotion/styled';
import { mq } from '../utils';
interface StyledKeyValueProps {}

const StyledKeyValue = styled('div')<StyledKeyValueProps>`
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 10px;
  border-radius: 5px;
  font-size: 16px;
  background-color: ${props => (props ? '#f0f0f0' : '#d9e2e7')};
  }
`;

interface KeyValueProps {
    keyName ?: string;
    value ?: string;
    dark ?: boolean;
}

const KeyValue = ({
  keyName,
  value,
}: KeyValueProps) => {
    return (
        <StyledKeyValue dark={false}>
            <div className="key">{keyName}</div>
            <div className="value">{value}</div>
        </StyledKeyValue>
    );
};

export default KeyValue;
