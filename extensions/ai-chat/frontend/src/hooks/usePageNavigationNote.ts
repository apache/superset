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
import { Dispatch, MutableRefObject, useEffect, useRef, useState } from 'react';
import { translation } from '@apache-superset/core';
import { fetchResourceName } from '../api/resourceName';
import { ConversationAction, itemId } from '../state/conversation';
import { currentResource, pageLabel } from './usePage';
import type { Page, ResourceContext } from '../types';

const { t } = translation;

/**
 * Path plus query of the current location, without the origin. Staying
 * relative keeps notes linking inside this Superset instance only.
 */
function currentHref(): string {
  const { pathname, search } = window.location;
  return `${pathname}${search}`;
}

/** Identity of the entity in view, ignoring incidental query changes */
function resourceKey(resource: ResourceContext | null): string {
  return resource ? `${resource.kind}:${resource.id_or_slug}` : '';
}

export interface NavigationScope {
  /** Ref to the current page, read by handlers without re-creating them */
  pageRef: MutableRefObject<Page>;
  /** The entity in view, once its name resolves; null on list pages */
  scope: { kind: ResourceContext['kind']; name: string } | null;
}

/**
 * Notes navigation in the transcript instead of discarding the conversation.
 * Handlers read the returned ref so a turn always carries the page the user
 * is on, without the handlers being recreated on every navigation.
 */

export function usePageNavigationNote(
  page: Page,
  hasMessages: boolean,
  dispatch: Dispatch<ConversationAction>,
): NavigationScope {
  const pageRef = useRef(page);
  const hrefRef = useRef(currentHref());
  const keyRef = useRef(resourceKey(currentResource(page)));
  // Name of the entity being left behind, when it resolved while in view
  const nameRef = useRef<string | null>(null);
  const [scope, setScope] = useState<NavigationScope['scope']>(null);
  // Read by the listener below, which must survive every render
  const latest = useRef({ page, hasMessages, dispatch });
  latest.current = { page, hasMessages, dispatch };
  // Lets the page-change effect below run the same check immediately
  const noticeRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let disposed = false;

    /** Reacts to landing on a different page or a different entity */
    function notice(): void {
      const { page: current, hasMessages: hadMessages } = latest.current;
      const resource = currentResource(current);
      const key = resourceKey(resource);
      if (current === pageRef.current && key === keyRef.current) return;

      const previousPage = pageRef.current;
      const previousHref = hrefRef.current;
      const previousName = nameRef.current;
      pageRef.current = current;
      keyRef.current = key;
      hrefRef.current = currentHref();
      nameRef.current = null;

      // Resolve the new entity's name so the next navigation and the next
      // turn's page context can carry it. Nothing waits on this: a slow or
      // failed lookup leaves the label generic
      setScope(null);
      if (resource) {
        fetchResourceName(resource).then(name => {
          if (disposed || keyRef.current !== key) return;
          nameRef.current = name;
          setScope(name ? { kind: resource.kind, name } : null);
        });
      }

      if (hadMessages) {
        latest.current.dispatch({
          type: 'page_changed',
          noteId: itemId('note'),
          note: t('You navigated to %s.', pageLabel(current)),
          href: hrefRef.current,
          back: {
            href: previousHref,
            label: t('Back to %s', previousName || pageLabel(previousPage)),
          },
        });
      }
    }

    // Resolve the name of wherever the conversation starts, so the first
    // turn can carry it
    const initial = currentResource(latest.current.page);
    if (initial) {
      fetchResourceName(initial).then(name => {
        if (disposed || keyRef.current !== resourceKey(initial)) return;
        nameRef.current = name;
        setScope(name ? { kind: initial.kind, name } : null);
      });
    }

    noticeRef.current = notice;
    // Reaching another dashboard goes through the dashboard list, so the page
    // type changes and the host reports it. Browser back/forward between two
    // dashboards is the one route that stays on the same page type, and
    // popstate reports it
    window.addEventListener('popstate', notice);
    return () => {
      disposed = true;
      window.removeEventListener('popstate', notice);
    };
  }, []);

  // The host reports a page-type change immediately, so act on it here rather
  // than waiting for a popstate that a pushState navigation never fires
  useEffect(() => {
    noticeRef.current();
  }, [page]);

  return { pageRef, scope };
}
