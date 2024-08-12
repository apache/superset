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
import { useEffect, useState } from 'react';
import {
  t,
  SupersetTheme,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import { AntdSwitch } from 'src/components';
import InfoTooltip from 'src/components/InfoTooltip';
import { isEmpty } from 'lodash';
import { infoTooltip, toggleStyle } from './styles';
import { SwitchProps } from '../types';

const SSHTunnelSwitch = ({
  clearValidationErrors,
  changeMethods,
  db,
  dbModel,
}: SwitchProps) => {
  const [isChecked, setChecked] = useState(false);
  const sshTunnelEnabled = isFeatureEnabled(FeatureFlag.SshTunneling);
  const disableSSHTunnelingForEngine =
    dbModel?.engine_information?.disable_ssh_tunneling || false;
  const isSSHTunnelEnabled = sshTunnelEnabled && !disableSSHTunnelingForEngine;

  const handleOnChange = (changed: boolean) => {
    setChecked(changed);
    changeMethods.onParametersChange({
      target: {
        type: 'toggle',
        name: 'ssh',
        checked: true,
        value: changed,
      },
    });
    clearValidationErrors();
  };

  useEffect(() => {
    if (isSSHTunnelEnabled && db?.parameters?.ssh !== undefined) {
      setChecked(db.parameters.ssh);
    }
  }, [db?.parameters?.ssh, isSSHTunnelEnabled]);

  useEffect(() => {
    if (
      isSSHTunnelEnabled &&
      db?.parameters?.ssh === undefined &&
      !isEmpty(db?.ssh_tunnel)
    ) {
      // reflecting the state of the ssh tunnel on first load
      changeMethods.onParametersChange({
        target: {
          type: 'toggle',
          name: 'ssh',
          checked: true,
          value: true,
        },
      });
    }
  }, [changeMethods, db?.parameters?.ssh, db?.ssh_tunnel, isSSHTunnelEnabled]);

  return isSSHTunnelEnabled ? (
    <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
      <AntdSwitch
        checked={isChecked}
        onChange={handleOnChange}
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
};

export default SSHTunnelSwitch;
