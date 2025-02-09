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
import { t, styled, useTheme } from '@superset-ui/core';

import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import {
    LOG_ACTIONS_AI_ASSISTANT_OPENED
} from 'src/logger/LogUtils';
import useLogAction from 'src/logger/useLogAction';

export interface AiAssistantActionButtonProps {
  queryEditorId: string;
}

const StyledButton = styled.span`
  button {
    line-height: 13px;
  }
`;

const StyledIcon = styled(Icons.Lightbulb)`
  &:first-of-type {
    margin: 0;
    display: flex;
    svg {
      margin: 0;
    }
  }
`;

const onClick = (
  logAction: (name: string, payload: Record<string, any>) => void,
): void => {
  logAction(LOG_ACTIONS_AI_ASSISTANT_OPENED, { shortcut: false });
  alert('Launching AI assistant');
};

const AiAssistantActionButton = ({
  queryEditorId,
}: AiAssistantActionButtonProps) => {
  const theme = useTheme();
  const logAction = useLogAction({ queryEditorId });

  return (
    <StyledButton>
      <Button
        buttonSize='small'
        onClick={() =>
          onClick(logAction)
        }
        tooltip={t('Launch AI Assistant') as string
        }
      >
        <StyledIcon iconColor={theme.colors.primary.base} iconSize="xl" />
        {t('AI Assistant')}
      </Button>
    </StyledButton>
  );
};

export default AiAssistantActionButton;
