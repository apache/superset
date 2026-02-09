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

import { useState } from 'react';
import { styled } from '@apache-superset/core/ui';
import { Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

const PayloadContainer = styled.div`
  max-width: 400px;
  max-height: 300px;
  overflow: auto;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const PayloadPre = styled.pre`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

const InfoIconWrapper = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colorIcon};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

interface TaskPayloadPopoverProps {
  payload: Record<string, any>;
}

export default function TaskPayloadPopover({
  payload,
}: TaskPayloadPopoverProps) {
  const [visible, setVisible] = useState(false);

  const content = (
    <PayloadContainer>
      <PayloadPre>{JSON.stringify(payload, null, 2)}</PayloadPre>
    </PayloadContainer>
  );

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="leftTop"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <InfoIconWrapper>
        <Icons.InfoCircleOutlined iconSize="l" />
      </InfoIconWrapper>
    </Popover>
  );
}
