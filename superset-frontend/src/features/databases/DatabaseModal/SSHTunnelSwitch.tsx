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
import { t, SupersetTheme, SwitchProps } from '@superset-ui/core';
import { AntdSwitch } from 'src/components';
import InfoTooltip from 'src/components/InfoTooltip';
import { isEmpty } from 'lodash';
import { ActionType } from '.';
import { infoTooltip, toggleStyle } from './styles';

const SSHTunnelSwitch = ({
  isEditMode,
  dbFetched,
  useSSHTunneling,
  setUseSSHTunneling,
  setDB,
  isSSHTunneling,
}: SwitchProps) =>
  isSSHTunneling ? (
    <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
      <AntdSwitch
        disabled={isEditMode && !isEmpty(dbFetched?.ssh_tunnel)}
        checked={useSSHTunneling}
        onChange={changed => {
          setUseSSHTunneling(changed);
          if (!changed) {
            setDB({
              type: ActionType.removeSSHTunnelConfig,
            });
          }
        }}
        data-test="ssh-tunnel-switch"
      />
      <span css={toggleStyle}>{t('SSH Tunnel')}</span>
      <InfoTooltip
        tooltip={t('SSH Tunnel configuration parameters')}
        placement="right"
        viewBox="0 -5 24 24"
      />
    </div>
  ) : null;
export default SSHTunnelSwitch;
