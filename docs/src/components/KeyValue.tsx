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

interface StyledKeyValueProps {
  dark?: boolean;
}

const StyledKeyValue = styled('div')<StyledKeyValueProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 6px;
  font-size: 14px;
  background-color: ${props => (props.dark ? '#2d2d2d' : '#f5f5f5')};
  border: 1px solid ${props => (props.dark ? '#404040' : '#e0e0e0')};
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => (props.dark ? '#353535' : '#ebebeb')};
  }

  .key {
    font-weight: 600;
    color: ${props => (props.dark ? '#e0e0e0' : '#333')};
    flex-shrink: 0;
    margin-right: 16px;
  }

  .value {
    color: ${props => (props.dark ? '#a0a0a0' : '#666')};
    text-align: right;
    word-break: break-word;
  }
`;

interface KeyValueProps {
  keyName?: string;
  value?: string;
  dark?: boolean;
}

const KeyValue = ({ keyName, value, dark = false }: KeyValueProps) => {
  return (
    <StyledKeyValue dark={dark}>
      <div className="key">{keyName}</div>
      <div className="value">{value}</div>
    </StyledKeyValue>
  );
};

export default KeyValue;
