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
import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { Alert, Button, Flex } from 'antd';
import { chat, theme, translation } from '@apache-superset/core';
import { sendChat, sendToolApproval } from '../api/client';
import { requestActivity } from '../state/activity';
import {
  conversationReducer,
  itemId,
  newConversation,
  trimHistory,
} from '../state/conversation';
import { useChatConfig } from '../hooks/useChatConfig';
import { useConversationPersistence } from '../hooks/useConversationPersistence';
import { useEntityReferences } from '../hooks/useEntityReferences';
import { usePageNavigationNote } from '../hooks/usePageNavigationNote';
import { useRequestRunner } from '../hooks/useRequestRunner';
import { buildPageContext, usePage } from '../hooks/usePage';
import {
  Attachment,
  attachmentImages,
  attachmentRefs,
  composeMessage,
  exceedsImageBudget,
} from '../utils/attachments';
import type { FoldSignal, PendingApproval } from '../types';
import ApprovalCard from './ApprovalCard';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import ChatStatusAlerts from './ChatStatusAlerts';
import MessageList from './MessageList';
import WelcomeState from './WelcomeState';

const { t } = translation;
const { useTheme } = theme;

/**
 * The chat panel, mounted by the Superset chat host. Composition only:
 * conversation state lives in the reducer, and config, persistence,
 * navigation notes and request lifecycle each live in their own hook.
 */
export default function ChatPanel() {
  const theme = useTheme();
  const page = usePage();
  const configState = useChatConfig();
  const [mode, setMode] = useState(chat.getDisplayMode());
  const [state, dispatch] = useReducer(conversationReducer, null, () =>
    newConversation(null),
  );

  const entities = useEntityReferences();
  const persistence = useConversationPersistence(state, dispatch);
  const { pageRef, scope } = usePageNavigationNote(
    page,
    state.items.length > 0,
    dispatch,
  );
  // The header's fold instruction, alternating between collapsing the whole
  // transcript and reopening it
  const [fold, setFold] = useState<FoldSignal>({ seq: 0, collapsed: false });
  const { run, retry, cancel } = useRequestRunner(dispatch);

  useEffect(() => {
    const { dispose } = chat.onDidChangeDisplayMode(next => setMode(next));
    return () => {
      dispose();
    };
  }, []);

  useEffect(() => {
    requestActivity.set(state.status === 'sending');
    return () => requestActivity.set(false);
  }, [state.status]);

  const handleSend = useCallback(
    (content: string, attachments: Attachment[] = []) => {
      // Attached files ride inside the message the model receives so they
      // stay available for follow-up questions, while the transcript shows
      // the typed text with the file names beside it
      const sent = composeMessage(content, attachments);
      const images = attachmentImages(attachments);
      if (exceedsImageBudget(state.history, images)) {
        // Recording the message first would leave it in the replayed history
        // and fail every later turn the same way.
        dispatch({
          type: 'request_error',
          message: t(
            'That is more image data than one conversation can carry. Remove an image, or clear the conversation and start again.',
          ),
        });
        return;
      }
      dispatch({
        type: 'user_message',
        id: itemId('msg'),
        content,
        sent,
        attachments: attachmentRefs(attachments),
        references: entities.references,
        images,
      });
      run(signal =>
        sendChat(
          {
            conversation_id: state.conversationId,
            messages: trimHistory([
              ...state.history,
              {
                role: 'user',
                content: sent,
                ...(images.length ? { images } : {}),
              },
            ]),
            context: buildPageContext(pageRef.current, entities.references),
          },
          signal,
        ),
      );
    },
    [run, state.conversationId, state.history, pageRef, entities.references],
  );

  const handleDecision = useCallback(
    (pending: PendingApproval, decision: 'approve' | 'reject') => {
      dispatch({ type: 'approval_submitted' });
      run(signal =>
        sendToolApproval(
          {
            conversation_id: state.conversationId,
            messages: state.history,
            context: buildPageContext(pageRef.current, entities.references),
            approval_id: pending.approvalId,
            decision,
            tool_call: {
              id: pending.toolCallId,
              name: pending.tool,
              arguments: pending.arguments,
            },
          },
          signal,
        ),
      );
    },
    [run, state.conversationId, state.history, pageRef, entities.references],
  );

  const handleNewConversation = useCallback(() => {
    cancel();
    // The next transcript starts expanded, so the button offers to fold again
    setFold(({ seq }) => ({ seq: seq + 1, collapsed: false }));
    dispatch({
      type: 'reset',
      conversationId: newConversation(null).conversationId,
      page,
    });
    persistence.clear();
    // Dropped context belongs to the conversation being discarded.
    entities.clear();
  }, [cancel, page, persistence, entities]);

  const enabled =
    configState.status === 'ready' &&
    configState.config.enabled &&
    configState.config.provider_configured;
  const busy = state.status === 'sending';
  const { pending } = state;

  return (
    <Flex
      data-test="ai-chat-panel"
      vertical
      style={{
        boxSizing: 'border-box',
        width: mode === 'panel' ? '100%' : 600,
        height: mode === 'panel' ? '100%' : 'min(760px, 90vh)',
        background: theme.colorBgElevated,
        border: `1px solid ${theme.colorBorderSecondary}`,
        borderRadius: mode === 'panel' ? 0 : theme.borderRadiusLG,
        boxShadow: mode === 'panel' ? 'none' : theme.boxShadowSecondary,
        overflow: 'hidden',
      }}
    >
      <ChatHeader
        page={page}
        scope={scope}
        mode={mode}
        hasContent={state.items.length > 0}
        collapsed={fold.collapsed}
        onToggleCollapseAll={() =>
          setFold(({ seq, collapsed }) => ({
            seq: seq + 1,
            collapsed: !collapsed,
          }))
        }
        onNewConversation={handleNewConversation}
        onToggleMode={() =>
          chat.setDisplayMode(mode === 'panel' ? 'floating' : 'panel')
        }
        onClose={() => chat.close()}
      />

      <ChatStatusAlerts configState={configState} />

      {state.items.length === 0 ? (
        <WelcomeState page={page} disabled={!enabled} onPick={handleSend} />
      ) : (
        <MessageList items={state.items} busy={busy} fold={fold} />
      )}

      {pending && (
        <div style={{ padding: `${theme.paddingXS}px ${theme.paddingSM}px` }}>
          <ApprovalCard
            pending={pending}
            disabled={busy}
            onDecision={decision => handleDecision(pending, decision)}
          />
        </div>
      )}

      {state.error && (
        <Alert
          type="error"
          showIcon
          role="alert"
          aria-live="assertive"
          closable={{ onClose: () => dispatch({ type: 'clear_error' }) }}
          style={{ margin: theme.marginXS }}
          data-test="chat-error"
          title={state.error}
          action={
            <Button size="small" onClick={retry} data-test="chat-retry">
              {t('Retry')}
            </Button>
          }
        />
      )}

      <div style={{ borderTop: `1px solid ${theme.colorBorderSecondary}` }}>
        <ChatInput
          disabled={!enabled || Boolean(pending)}
          busy={busy}
          onSend={handleSend}
          onCancel={cancel}
          entities={entities}
          autoFocus
        />
      </div>
    </Flex>
  );
}
