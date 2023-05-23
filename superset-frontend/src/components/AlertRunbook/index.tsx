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
import React, { FunctionComponent } from 'react';
import { t, styled } from '@superset-ui/core';
import Button from '../Button';
import { Tooltip } from '../Tooltip';

interface RunbookProps {
  title: string;
}

const RunbookContainer = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
  position: relative;
  cursor: pointer;
  width: auto;
  float: right;
`;

export const AlertRunbook: FunctionComponent<RunbookProps> = ({ title }) => {
  const routeToRunbook = () => {
    const url = '';
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <RunbookContainer>
      <Tooltip title="Please refer to Alerts & Reports Run book for further understanding of errors being faced while its execution">
        <Button buttonStyle="dashed" onClick={routeToRunbook}>
          {t(title)}
        </Button>
      </Tooltip>
    </RunbookContainer>
  );
};

export default AlertRunbook;
