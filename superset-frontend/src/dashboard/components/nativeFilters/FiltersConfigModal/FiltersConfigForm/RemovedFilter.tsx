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
import Button, { OnClickHandler } from 'src/components/Button';
import React, { FC } from 'react';
import { styled, t } from '@superset-ui/core';

const RemovedContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 400px; // arbitrary
  text-align: center;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

type RemovedFilterProps = {
  onClick: OnClickHandler;
};

const RemovedFilter: FC<RemovedFilterProps> = ({ onClick }) => (
  <RemovedContent>
    <p>{t('You have removed this filter.')}</p>
    <div>
      <Button
        data-test="restore-filter-button"
        buttonStyle="primary"
        onClick={onClick}
      >
        {t('Restore Filter')}
      </Button>
    </div>
  </RemovedContent>
);

export default RemovedFilter;
