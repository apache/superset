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
/**
 * Client for the AI chat gateway. Extensions cannot import the host-internal
 * SupersetClient, so requests use fetch with a CSRF token from the public
 * authentication API. Provider secrets stay server-side.
 */
import { authentication } from '@apache-superset/core';
import type {
  AiChatConfig,
  ChatTurnResult,
  PageContext,
  ProtocolMessage,
  ProtocolToolCall,
} from '../types';

const API_BASE = '/api/v1/ai_chat';

export class ChatApiError extends Error {
  status: number;

  errorCode: string | null;

  constructor(message: string, status: number, errorCode: string | null) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

function extractErrorMessage(body: unknown): {
  message: string | null;
  errorCode: string | null;
} {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const message =
      typeof record.message === 'string'
        ? record.message
        : record.message && typeof record.message === 'object'
          ? JSON.stringify(record.message)
          : null;
    const errorCode =
      typeof record.error_code === 'string' ? record.error_code : null;
    return { message, errorCode };
  }
  return { message: null, errorCode: null };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const { message, errorCode } = extractErrorMessage(body);
    throw new ChatApiError(
      message || `Request failed (HTTP ${response.status})`,
      response.status,
      errorCode,
    );
  }
  return body as T;
}

async function postJson<T>(
  path: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const csrfToken = await authentication.getCSRFToken();
  return request<T>(path, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchChatConfig(): Promise<AiChatConfig> {
  const body = await request<{ result: AiChatConfig }>('/config');
  return body.result;
}

export interface ChatRequestPayload {
  conversation_id: string;
  messages: ProtocolMessage[];
  context?: PageContext | null;
}

export async function sendChat(
  payload: ChatRequestPayload,
  signal?: AbortSignal,
): Promise<ChatTurnResult> {
  const body = await postJson<{ result: ChatTurnResult }>(
    '/chat',
    payload,
    signal,
  );
  return body.result;
}

export interface ToolApprovalPayload extends ChatRequestPayload {
  approval_id: string;
  decision: 'approve' | 'reject';
  tool_call: ProtocolToolCall;
}

export async function sendToolApproval(
  payload: ToolApprovalPayload,
  signal?: AbortSignal,
): Promise<ChatTurnResult> {
  const body = await postJson<{ result: ChatTurnResult }>(
    '/tool_approval',
    payload,
    signal,
  );
  return body.result;
}
