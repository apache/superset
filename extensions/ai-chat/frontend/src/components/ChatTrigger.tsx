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
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { chat, translation } from '@apache-superset/core';
import { requestActivity } from '../state/activity';

const { t } = translation;

/**
 * Always-visible entry point, positioned by the host. Toggles the panel and
 * shows a processing badge while a request is in flight.
 */
export default function ChatTrigger() {
  const [open, setOpen] = useState(chat.isOpen());
  const active = useSyncExternalStore(
    requestActivity.subscribe,
    requestActivity.get,
    requestActivity.get,
  );

  useEffect(() => {
    const openSub = chat.onDidOpen(() => setOpen(true));
    const closeSub = chat.onDidClose(() => setOpen(false));
    return () => {
      openSub.dispose();
      closeSub.dispose();
    };
  }, []);

  const label = open ? t('Close AI assistant') : t('Open AI assistant');
  return (
    <Tooltip title={t('Superset AI Assistant')} placement="left">
      <Badge dot={active} status="processing" offset={[-6, 6]}>
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
          aria-label={label}
          aria-expanded={open}
          data-test="ai-chat-trigger"
          onClick={() => (chat.isOpen() ? chat.close() : chat.open())}
        />
      </Badge>
    </Tooltip>
  );
}
