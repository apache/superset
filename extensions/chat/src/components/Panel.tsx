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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { streamReply } from '../streaming/mockStream';
import { getPageContext, PageContext, subscribeToPageChanges } from '../context/pageContext';
import { registerActiveController, unregisterActiveController } from '../streaming/registry';

interface Props {
  onClose: () => void;
}

interface Message {
  id: number;
  from: 'user' | 'bot';
  text: string;
}

let messageSeq = 0;

export const Panel: React.FC<Props> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>(() => getPageContext());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => subscribeToPageChanges(() => setPageContext(getPageContext())),
    [],
  );

  useEffect(
    () => () => {
      // Component unmount cancels any in-flight stream.
      controllerRef.current?.abort();
    },
    [],
  );

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || streaming) return;
    setInput('');
    const userMsg: Message = { id: ++messageSeq, from: 'user', text: prompt };
    const botMsg: Message = { id: ++messageSeq, from: 'bot', text: '' };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setStreaming(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    registerActiveController(controller);

    try {
      for await (const token of streamReply(prompt, controller.signal)) {
        setMessages(prev =>
          prev.map(m => (m.id === botMsg.id ? { ...m, text: m.text + token } : m)),
        );
      }
    } finally {
      unregisterActiveController(controller);
      controllerRef.current = null;
      setStreaming(false);
    }
  }, [input, streaming]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return (
    <div
      data-test="reference-chatbot-panel"
      style={{
        width: 360,
        maxHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        fontSize: 13,
      }}
    >
      <header
        style={{
          padding: '8px 12px',
          background: '#1f6feb',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Reference Chatbot</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chatbot"
          data-test="reference-chatbot-close"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>

      <div
        data-test="reference-chatbot-context"
        style={{
          padding: '6px 12px',
          background: '#f6f8fa',
          borderBottom: '1px solid #eaecef',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#57606a',
          wordBreak: 'break-all',
        }}
      >
        page: {pageContext.pageType}
        {pageContext.sqlLab ? ` · tab: ${pageContext.sqlLab.title}` : ''}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.length === 0 && (
          <p style={{ color: '#8c8c8c' }}>
            Ask anything — replies are canned tokens streamed by the reference extension.
          </p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            data-test={`reference-chatbot-msg-${m.from}`}
            style={{
              margin: '6px 0',
              textAlign: m.from === 'user' ? 'right' : 'left',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                borderRadius: 6,
                background: m.from === 'user' ? '#1f6feb' : '#eef0f3',
                color: m.from === 'user' ? '#fff' : '#1f2328',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.text || '…'}
            </span>
          </div>
        ))}
      </div>

      <footer
        style={{
          padding: 8,
          borderTop: '1px solid #eaecef',
          display: 'flex',
          gap: 6,
        }}
      >
        <input
          aria-label="Chat input"
          data-test="reference-chatbot-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: '4px 8px',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
          }}
        />
        {streaming ? (
          <button
            type="button"
            onClick={cancel}
            data-test="reference-chatbot-cancel"
            style={{ padding: '4px 10px' }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            data-test="reference-chatbot-send"
            disabled={!input.trim()}
            style={{ padding: '4px 10px' }}
          >
            Send
          </button>
        )}
      </footer>
    </div>
  );
};
