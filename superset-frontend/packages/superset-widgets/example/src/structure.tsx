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

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { WidgetCode } from './WidgetCode';

/** `superset` = a component from `@apache-superset/widgets`; `host` = this app's own code. */
export type FrameKind = 'superset' | 'host';

interface FrameNode {
  id: string;
  parentId: string | null;
  label: string;
  detail?: string;
  kind: FrameKind;
  order: number;
}

class FrameRegistry {
  private nodes = new Map<string, FrameNode>();

  private listeners = new Set<() => void>();

  private snapshot: FrameNode[] = [];

  private counter = 0;

  register(node: Omit<FrameNode, 'order'>): () => void {
    // React commits layout effects child-first in tree order, so a counter
    // taken at first registration keeps siblings in render order.
    const order = this.nodes.get(node.id)?.order ?? (this.counter += 1);
    this.nodes.set(node.id, { ...node, order });
    this.emit();
    return () => {
      this.nodes.delete(node.id);
      this.emit();
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FrameNode[] => this.snapshot;

  private emit(): void {
    this.snapshot = [...this.nodes.values()];
    this.listeners.forEach(listener => listener());
  }
}

interface StructureState {
  registry: FrameRegistry;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const StructureContext = createContext<StructureState | null>(null);
const ParentFrameContext = createContext<string | null>(null);

function useStructure(): StructureState {
  const state = useContext(StructureContext);
  if (!state) throw new Error('Wrap the app in <StructureProvider>');
  return state;
}

export function StructureProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => new FrameRegistry(), []);
  const [visible, setVisible] = useState(false);
  const value = useMemo(
    () => ({ registry, visible, setVisible }),
    [registry, visible],
  );
  return (
    <StructureContext.Provider value={value}>
      {children}
    </StructureContext.Provider>
  );
}

export function useStructureVisible(): [boolean, (visible: boolean) => void] {
  const { visible, setVisible } = useStructure();
  return [visible, setVisible];
}

/**
 * A layout box that also names the component inside it, so the page can show
 * its own React structure: an outline + tag when structure is visible, an
 * entry in the live tree either way, and — with `code` — a button that shows
 * the JSX to embed the element it wraps.
 */
export function Frame({
  label,
  detail,
  kind,
  code = false,
  as: Tag = 'div',
  className,
  children,
}: {
  label: string;
  detail?: string;
  kind: FrameKind;
  code?: boolean;
  as?: 'div' | 'section' | 'aside' | 'main';
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const parentId = useContext(ParentFrameContext);
  const { registry, visible } = useStructure();

  useLayoutEffect(
    () => registry.register({ id, parentId, label, detail, kind }),
    [registry, id, parentId, label, detail, kind],
  );

  const classes = [
    className,
    code && 'frame-with-code',
    visible && 'frame',
    visible && `frame-${kind}`,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <ParentFrameContext.Provider value={id}>
      {children}
    </ParentFrameContext.Provider>
  );

  if (!code) {
    return (
      <Tag className={classes || undefined} data-component={label}>
        {visible && <span className="frame-tag">{label}</span>}
        {content}
      </Tag>
    );
  }

  // The button gets its own row: overlaid on the widget it covers titles,
  // inputs and table headers.
  return (
    <Tag className={classes} data-component={label}>
      <div className="frame-head">
        <code className="frame-name">{label}</code>
        <WidgetCode element={children} title={label} />
      </div>
      <div className="frame-body">{content}</div>
    </Tag>
  );
}

function TreeLevel({
  nodes,
  parentId,
}: {
  nodes: FrameNode[];
  parentId: string | null;
}) {
  const children = nodes
    .filter(node => node.parentId === parentId)
    .sort((a, b) => a.order - b.order);
  if (children.length === 0) return null;
  return (
    <ul>
      {children.map(node => (
        <li key={node.id}>
          <code className={`tree-${node.kind}`}>{node.label}</code>
          {node.detail && <span className="tree-detail">{node.detail}</span>}
          <TreeLevel nodes={nodes} parentId={node.id} />
        </li>
      ))}
    </ul>
  );
}

/** The component tree the page actually rendered, built from its `Frame`s. */
export function StructureTree() {
  const { registry } = useStructure();
  const nodes = useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  return (
    <div className="structure-tree">
      <p className="legend">
        <code className="tree-superset">Superset component</code>{' '}
        <code className="tree-host">host app code</code>
      </p>
      <TreeLevel nodes={nodes} parentId={null} />
    </div>
  );
}
