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

import { CSSProperties, FC, ReactNode } from 'react';
import { styled } from '@apache-superset/core/theme';
import {
  Button,
  Card,
  Collapse,
  Divider,
  Input,
  Modal,
  Progress,
  SafeMarkdown,
  Select,
  Switch,
  Tabs,
} from '@superset-ui/core/components';
import { Alert } from '@apache-superset/core/components';
import { CatalogEntry, NODE_CATALOG } from './catalog';
import { CdlFilter, CdlNode, Primitive, isVizNode } from './types';
import { EchartsViz } from './EchartsViz';
import { FilterControl } from './FilterControl';
import { SupersetChartViz } from './SupersetChartViz';
import { useUiState } from './runtime';

/**
 * The manifest maps a catalog type to a React adapter. Adapters are thin: the
 * renderer resolves props/bindings/events generically and hands them here; each
 * adapter only knows how to wire the normalized inputs onto its component.
 */
export interface AdapterProps {
  node: CdlNode;
  resolvedProps: Record<string, unknown>;
  children?: ReactNode;
  /** Run the node's declarative handler list for an event. */
  fire: (event: string, value?: Primitive) => void;
  /** Current value of a two-way-bound prop (from the variable store). */
  getBound: (prop: string) => Primitive | undefined;
  /** Write a two-way-bound prop back to the variable store. */
  setBound: (prop: string, value: Primitive) => void;
  /**
   * Render a specific child node. Containers that need structural control over
   * their children (e.g. Tabs) use this instead of the flat `children`.
   */
  renderNode: (child: CdlNode) => ReactNode;
  /** Resolved inline styling from the node's `style` (theme tokens applied). */
  style?: CSSProperties;
}

export interface ManifestEntry {
  component: FC<AdapterProps>;
  catalog: CatalogEntry;
}

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  width: 100%;
  /* padding must not widen the box (no global reset in this codebase) */
  box-sizing: border-box;
  min-width: 0;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  /* Wrap rather than overflow on narrow viewports. */
  flex-wrap: wrap;
  & > * {
    flex: 1 1 0;
    min-width: 0;
  }
`;

const ColumnAdapter: FC<AdapterProps> = ({ children, style }) => (
  <Column style={style}>{children}</Column>
);

const RowAdapter: FC<AdapterProps> = ({ children, style }) => (
  <Row style={style}>{children}</Row>
);

interface Option {
  value: string | number;
  label: string;
}

const SelectAdapter: FC<AdapterProps> = ({
  resolvedProps,
  fire,
  getBound,
  setBound,
  style,
}) => {
  const bound = getBound('value');
  const value = bound ?? (resolvedProps.value as Primitive | undefined);
  const options = (resolvedProps.options as Option[]) ?? [];
  return (
    <div style={style}>
      <Select
        ariaLabel={(resolvedProps.label as string) ?? 'Select'}
        header={resolvedProps.label as ReactNode}
        options={options}
        value={(value ?? null) as string | number | null}
        onChange={(next: unknown) => {
          const val = next as Primitive;
          setBound('value', val);
          fire('change', val);
        }}
      />
    </div>
  );
};

// Agents label controls under varying keys — accept the common ones.
const firstText = (
  props: Record<string, unknown>,
  keys: string[],
): ReactNode => {
  const key = keys.find(k => props[k] != null);
  return key ? (props[key] as ReactNode) : undefined;
};

const ButtonAdapter: FC<AdapterProps> = ({ resolvedProps, fire, style }) => (
  <Button
    style={style}
    buttonStyle={
      (resolvedProps.buttonStyle as 'primary' | 'secondary') ?? 'secondary'
    }
    buttonSize="small"
    onClick={() => fire('click')}
  >
    {firstText(resolvedProps, [
      'children',
      'label',
      'text',
      'title',
      'content',
    ]) ?? 'Button'}
  </Button>
);

const MarkdownAdapter: FC<AdapterProps> = ({ resolvedProps, style }) => {
  const source = firstText(resolvedProps, [
    'text',
    'source',
    'content',
    'markdown',
  ]);
  return (
    <div
      data-test="canvas-markdown"
      // SafeMarkdown wraps text in <p>/<h*> with default outer margins, which
      // inflates a node's height — in a fixed-height Board that overflows into
      // the cell below. Collapse the leading/trailing margins; inter-paragraph
      // spacing (for narrative docs) is preserved.
      css={{
        '& > :first-child': { marginTop: 0 },
        '& > :last-child': { marginBottom: 0 },
      }}
      style={style}
    >
      <SafeMarkdown source={source == null ? '' : String(source)} />
    </div>
  );
};

const InlineControl = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const CardAdapter: FC<AdapterProps> = ({ resolvedProps, children, style }) => (
  <Card
    title={firstText(resolvedProps, ['title', 'label', 'header'])}
    padded
    style={style}
  >
    {children}
  </Card>
);

const DividerAdapter: FC<AdapterProps> = ({ style }) => (
  <Divider style={style} />
);

/** Tabs owns its children structurally, so it renders them via `renderNode`. */
const TabsAdapter: FC<AdapterProps> = ({
  node,
  resolvedProps,
  renderNode,
  style,
}) => {
  const { activeTabs, setActiveTab } = useUiState();
  const tabNodes = (node.children ?? []).filter(child => child.type === 'Tab');
  const defaultKey = (resolvedProps.defaultTab as string) ?? tabNodes[0]?.id;
  const activeKey = activeTabs[node.id] ?? defaultKey;
  return (
    <Tabs
      style={style}
      activeKey={activeKey}
      onChange={key => setActiveTab(node.id, key)}
      items={tabNodes.map(tab => ({
        key: tab.id,
        label: String(
          firstText(tab.props ?? {}, ['label', 'title', 'text']) ?? tab.id,
        ),
        children: renderNode(tab),
      }))}
    />
  );
};

const TabAdapter: FC<AdapterProps> = ({ children, style }) => (
  <Column style={style}>{children}</Column>
);

/**
 * Freeform layout: children are placed by their `layout` {x,y,w,h,z} on a
 * `columns`-wide grid of `rowHeight`px rows. Overlap is allowed (grid areas can
 * share cells), which is why `z` exists. Responsive — columns are fractions.
 */
const BoardAdapter: FC<AdapterProps> = ({
  node,
  resolvedProps,
  renderNode,
  style,
}) => {
  const columns = Number(resolvedProps.columns ?? 12);
  const rowHeight = Number(resolvedProps.rowHeight ?? 40);
  const gap = Number(resolvedProps.gap ?? 8);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        // rowHeight is a MINIMUM, not a cap: rows grow to fit content so an
        // over-tall cell pushes the layout down instead of overlapping.
        gridAutoRows: `minmax(${rowHeight}px, auto)`,
        gap,
        width: '100%',
        ...style,
      }}
    >
      {(node.children ?? []).map(child => {
        const l = child.layout;
        // display:grid makes the single child stretch to fill the cell in both
        // dimensions, so a Viz with height:100% fills its board cell.
        const cell: CSSProperties = l
          ? {
              gridColumn: `${l.x + 1} / span ${l.w}`,
              gridRow: `${l.y + 1} / span ${l.h}`,
              zIndex: l.z,
              display: 'grid',
              minWidth: 0,
              minHeight: 0,
            }
          : { display: 'grid' };
        return (
          <div key={child.id} style={cell}>
            {renderNode(child)}
          </div>
        );
      })}
    </div>
  );
};

/** Narrative callouts — caveats, data-quality notes, "read this first". */
const AlertAdapter: FC<AdapterProps> = ({ resolvedProps, style }) => (
  <Alert
    style={style}
    type={
      (resolvedProps.type as 'info' | 'success' | 'warning' | 'error') ?? 'info'
    }
    message={firstText(resolvedProps, ['message', 'title', 'text', 'label'])}
    description={resolvedProps.description as ReactNode}
    showIcon={resolvedProps.showIcon !== false}
    closable={Boolean(resolvedProps.closable)}
  />
);

/** Goal / target tracking — value is bindable to a variable. */
const ProgressAdapter: FC<AdapterProps> = ({
  resolvedProps,
  getBound,
  style,
}) => {
  const bound = getBound('value');
  const percent = Number(bound ?? resolvedProps.value ?? 0);
  return (
    <div style={style}>
      {resolvedProps.label != null && <div>{String(resolvedProps.label)}</div>}
      <Progress
        percent={Number.isFinite(percent) ? percent : 0}
        type={(resolvedProps.type as 'line' | 'circle' | 'dashboard') ?? 'line'}
        status={
          resolvedProps.status as
            'success' | 'exception' | 'active' | 'normal' | undefined
        }
        strokeColor={resolvedProps.strokeColor as string | undefined}
      />
    </div>
  );
};

/** Collapsible sections — each child becomes a panel titled by its label. */
const CollapseAdapter: FC<AdapterProps> = ({ node, renderNode, style }) => {
  const sections = node.children ?? [];
  return (
    <Collapse
      style={style}
      ghost
      items={sections.map(section => ({
        key: section.id,
        label: String(
          firstText(section.props ?? {}, ['label', 'title', 'text']) ??
            section.id,
        ),
        children: renderNode(section),
      }))}
    />
  );
};

/**
 * A drill-in panel: hidden until an `openModal` action targets it, so a button
 * can reveal detail charts without leaving the canvas.
 */
const ModalAdapter: FC<AdapterProps> = ({ node, resolvedProps, children }) => {
  const { openModals, setModalOpen } = useUiState();
  return (
    <Modal
      show={Boolean(openModals[node.id])}
      onHide={() => setModalOpen(node.id, false)}
      title={firstText(resolvedProps, ['title', 'label', 'text'])}
      footer={null}
      width={resolvedProps.width as string | number | undefined}
      hideFooter
    >
      {children}
    </Modal>
  );
};

const InputAdapter: FC<AdapterProps> = ({
  resolvedProps,
  fire,
  getBound,
  setBound,
  style,
}) => {
  const bound = getBound('value');
  const value = String(bound ?? (resolvedProps.value as Primitive) ?? '');
  return (
    <InlineControl style={style}>
      {resolvedProps.label != null && (
        <span>{String(resolvedProps.label)}</span>
      )}
      <Input
        placeholder={resolvedProps.placeholder as string | undefined}
        value={value}
        onChange={event => {
          const next = event.target.value;
          setBound('value', next);
          fire('change', next);
        }}
      />
    </InlineControl>
  );
};

const SwitchAdapter: FC<AdapterProps> = ({
  resolvedProps,
  fire,
  getBound,
  setBound,
  style,
}) => {
  const bound = getBound('value');
  const checked = Boolean(bound ?? resolvedProps.value);
  return (
    <InlineControl style={style}>
      <Switch
        checked={checked}
        onChange={(next: boolean) => {
          setBound('value', next);
          fire('change', next);
        }}
      />
      {resolvedProps.label != null && (
        <span>{String(resolvedProps.label)}</span>
      )}
    </InlineControl>
  );
};

interface FilterOption {
  value: string | number;
  label: string;
}

const FilterAdapter: FC<AdapterProps> = ({ node, resolvedProps, style }) => (
  <FilterControl
    style={style}
    filterId={node.id}
    column={resolvedProps.column as string}
    datasetId={resolvedProps.dataset as number | undefined}
    label={resolvedProps.label as string | undefined}
    multiple={Boolean(resolvedProps.multiple)}
    op={resolvedProps.op as CdlFilter['op'] | undefined}
    options={resolvedProps.options as FilterOption[] | undefined}
  />
);

const VizAdapter: FC<AdapterProps> = ({ node, style }) => {
  if (!isVizNode(node)) {
    return null;
  }
  if (node.renderer === 'echarts') {
    return <EchartsViz node={node} style={style} />;
  }
  return <SupersetChartViz node={node} style={style} />;
};

export const MANIFEST: Record<string, ManifestEntry> = {
  Column: { component: ColumnAdapter, catalog: NODE_CATALOG.Column },
  Row: { component: RowAdapter, catalog: NODE_CATALOG.Row },
  Card: { component: CardAdapter, catalog: NODE_CATALOG.Card },
  Tabs: { component: TabsAdapter, catalog: NODE_CATALOG.Tabs },
  Tab: { component: TabAdapter, catalog: NODE_CATALOG.Tab },
  Board: { component: BoardAdapter, catalog: NODE_CATALOG.Board },
  Input: { component: InputAdapter, catalog: NODE_CATALOG.Input },
  Switch: { component: SwitchAdapter, catalog: NODE_CATALOG.Switch },
  Divider: { component: DividerAdapter, catalog: NODE_CATALOG.Divider },
  Alert: { component: AlertAdapter, catalog: NODE_CATALOG.Alert },
  Progress: { component: ProgressAdapter, catalog: NODE_CATALOG.Progress },
  Collapse: { component: CollapseAdapter, catalog: NODE_CATALOG.Collapse },
  Modal: { component: ModalAdapter, catalog: NODE_CATALOG.Modal },
  Select: { component: SelectAdapter, catalog: NODE_CATALOG.Select },
  Button: { component: ButtonAdapter, catalog: NODE_CATALOG.Button },
  Filter: { component: FilterAdapter, catalog: NODE_CATALOG.Filter },
  Markdown: { component: MarkdownAdapter, catalog: NODE_CATALOG.Markdown },
  Viz: { component: VizAdapter, catalog: NODE_CATALOG.Viz },
};
