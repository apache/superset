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
import { t, tn } from '@apache-superset/core/translation';
import type { VersionMeta } from 'src/features/versionHistory/types';

/** Versions are numbered from 1 for people; the API counts from 0. */
export const versionLabel = (version: VersionMeta) =>
  t('Version %s', version.version_number + 1);

/**
 * One line saying what a save changed, from its change records: widget
 * records are keyed by node id, the rest by the part of the canvas they touch.
 */
export function describeCanvasVersion(version: VersionMeta): string {
  if (version.operation_type === 'baseline') return t('Original version');
  const restore = version.changes.find(change => change.kind === '__meta__');
  if (restore) {
    const target = (restore.to_value as { version_number?: unknown } | null)
      ?.version_number;
    return typeof target === 'number'
      ? t('Restored version %s', target + 1)
      : t('Restored an earlier version');
  }

  const added = new Set<string>();
  const removed = new Set<string>();
  const moved = new Set<string>();
  const edited = new Set<string>();
  const resized = new Set<string>();
  let rootLayout = false;
  let settings = false;
  let interactions = false;
  let details = false;
  let renamedTo: string | undefined;
  version.changes.forEach(({ kind, operation, path, to_value: toValue }) => {
    const node = String(path[0]);
    const whole = path.length === 1;
    if (kind === 'widget') {
      if (whole && operation === 'add') added.add(node);
      else if (whole && operation === 'remove') removed.add(node);
      else if (whole && operation === 'move') moved.add(node);
      else edited.add(node);
    } else if (kind === 'layout') {
      if (path.length === 2) resized.add(node);
      else rootLayout = true;
    } else if (kind === 'setting') settings = true;
    else if (kind === 'interaction') interactions = true;
    else if (
      kind === 'field' &&
      node === 'title' &&
      typeof toValue === 'string'
    )
      renamedTo = toValue;
    else if (kind === 'field') details = true;
  });
  const besides = (nodes: Set<string>) =>
    [...nodes].filter(node => !added.has(node)).length;

  const parts: string[] = [];
  if (added.size) {
    parts.push(
      tn('Added %s widget', 'Added %s widgets', added.size, added.size),
    );
  }
  if (removed.size) {
    parts.push(
      tn('Removed %s widget', 'Removed %s widgets', removed.size, removed.size),
    );
  }
  const editedCount = besides(edited);
  if (editedCount) {
    parts.push(
      tn('Edited %s widget', 'Edited %s widgets', editedCount, editedCount),
    );
  }
  if (besides(moved) || besides(resized) || rootLayout) {
    parts.push(t('Rearranged the layout'));
  }
  if (interactions) parts.push(t('Changed filter scopes'));
  if (settings) parts.push(t('Changed settings'));
  if (renamedTo !== undefined) parts.push(t('Renamed to “%s”', renamedTo));
  if (details) parts.push(t('Changed details'));
  // A save with no canvas changes changed only the widgets it places.
  return parts.length ? parts.join(' · ') : t('Edited widget content');
}
