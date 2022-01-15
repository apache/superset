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
import React from 'react';

const ButtonComponent = styled.button<{ disabled: boolean }>`
  position: relative;
  bottom: 46px;
  left: 275px;
  width: 50px;
  height: 56px;
  border: 1px solid ${props => (props.disabled ? 'grey' : '#1A85A0')};
  border-radius: 3px;
  color: ${props => (props.disabled ? 'grey' : '#1A85A0')};
  background: white;
  text-align: center;
`;

export default function RunQueryButton(props: {
  setShouldRunQuery: Function;
  enableRunButton: boolean;
}) {
  const { setShouldRunQuery, enableRunButton } = props;

  return (
    <ButtonComponent
      disabled={!enableRunButton}
      onClick={() => setShouldRunQuery(true)}
    >
      Run
    </ButtonComponent>
  );
}
