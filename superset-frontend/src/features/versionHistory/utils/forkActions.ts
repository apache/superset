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
import { SupersetClient } from '@superset-ui/core';
import { VersionSnapshot } from '../types';

function buildCopyName(originalName: string, issuedAt: string): string {
  const datePart = issuedAt ? issuedAt.slice(0, 10) : '';
  return datePart
    ? `${originalName || 'Untitled'} (copy from ${datePart})`
    : `${originalName || 'Untitled'} (copy)`;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Creates a new chart from a version snapshot. POSTs the snapshot's
 * params/query_context/datasource fields with a forked slice_name and
 * returns the new chart's id.
 */
export async function forkChartFromSnapshot(
  snapshot: VersionSnapshot,
  ownerId?: number,
): Promise<{ id: number; name: string }> {
  const originalName =
    typeof snapshot.slice_name === 'string' ? snapshot.slice_name : '';
  const name = buildCopyName(originalName, String(snapshot.issued_at ?? ''));

  const body: Record<string, unknown> = {
    slice_name: name,
    datasource_id: snapshot.datasource_id,
    datasource_type: snapshot.datasource_type,
    viz_type: snapshot.viz_type,
  };
  if (typeof ownerId === 'number') body.owners = [ownerId];
  const params = asString(snapshot.params);
  if (params) body.params = params;
  const queryContext = asString(snapshot.query_context);
  if (queryContext) body.query_context = queryContext;
  if (snapshot.description) body.description = snapshot.description;
  if (snapshot.cache_timeout != null) {
    body.cache_timeout = snapshot.cache_timeout;
  }

  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/chart/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const id = (json as { id?: number } | undefined)?.id;
  if (typeof id !== 'number') {
    throw new Error('Chart copy did not return an id');
  }
  return { id, name };
}

/**
 * Creates a new dashboard from a version snapshot. POSTs the snapshot's
 * title + layout + metadata + css and returns the new dashboard's id.
 *
 * Note: the snapshot's ``position_json`` embeds slice ids that reference the
 * live charts, not duplicated copies. The forked dashboard will render with
 * the current state of those charts, not the snapshot's chart state. Use
 * restore (not fork) if you need historical chart content.
 */
export async function forkDashboardFromSnapshot(
  snapshot: VersionSnapshot,
  ownerId?: number,
): Promise<{ id: number; name: string }> {
  const originalName =
    typeof snapshot.dashboard_title === 'string'
      ? snapshot.dashboard_title
      : '';
  const name = buildCopyName(originalName, String(snapshot.issued_at ?? ''));

  const body: Record<string, unknown> = {
    dashboard_title: name,
  };
  if (typeof ownerId === 'number') body.owners = [ownerId];
  const positionJson = asString(snapshot.position_json);
  if (positionJson) body.position_json = positionJson;
  const jsonMetadata = asString(snapshot.json_metadata);
  if (jsonMetadata) body.json_metadata = jsonMetadata;
  if (typeof snapshot.css === 'string') body.css = snapshot.css;
  // Carry over user-visible scalars so the fork is recognizable.
  if (typeof snapshot.description === 'string') {
    body.description = snapshot.description;
  }
  if (typeof snapshot.published === 'boolean') {
    body.published = snapshot.published;
  }

  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/dashboard/',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const id = (json as { id?: number } | undefined)?.id;
  if (typeof id !== 'number') {
    throw new Error('Dashboard copy did not return an id');
  }
  return { id, name };
}
