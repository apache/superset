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
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t, tn } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Icons, Modal } from '@superset-ui/core/components';
import {
  type JsonContainer,
  jsonCellPreview,
  jsonCellWrappedText,
} from './parseJsonCellValue';
import { syncJsonCellRowHeight } from './jsonCellRowHeight';

const MAX_JSON_DEPTH = 32;
const JSON_CELL_ROW_CHROME_PX = 12;
const COPIED_RESET_MS = 2000;
const PREVIEW_TITLE_MAX_LENGTH = 500;

type JsonCellGridApi = {
  resetRowHeights?: () => void;
  onRowHeightChanged?: () => void;
  isDestroyed?: () => boolean;
};

type JsonCellRowNode = {
  setRowHeight?: (height: number | null | undefined) => void;
};

export type JsonCellRendererProps = {
  value: JsonContainer;
  rawText?: string;
  colId: string;
  autoHeight: boolean;
  wrapText?: boolean;
  jsonInCell?: boolean;
  api?: JsonCellGridApi;
  node?: JsonCellRowNode;
  eGridCell?: HTMLElement | null;
};

const Root = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit / 2}px;
    width: 100%;
    min-width: 0;
    white-space: inherit;
    word-break: inherit;
  `}
`;

const Toolbar = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    min-width: 0;

    &[data-wrap='true'] {
      align-items: flex-start;
    }
  `}
`;

const ToolbarMain = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
`;

const Preview = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;

  .dt-truncate-cell:hover & {
    overflow: visible;
    text-overflow: unset;
    white-space: normal;
  }

  &[data-wrap='true'] {
    overflow: visible;
    text-overflow: unset;
    white-space: normal;
    word-break: break-word;
  }
`;

const JsonToggle = styled.button`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 4}px;
    height: ${theme.sizeUnit * 4}px;
    padding: 0;
    border: none;
    background: transparent;
    color: ${theme.colorTextSecondary};
    cursor: pointer;
    flex: none;

    &:hover,
    &:focus-visible {
      color: ${theme.colorPrimary};
    }
  `}
`;

const JsonBlock = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-family: ${theme.fontFamilyCode};
  `}
`;

const JsonLine = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit}px;
    min-width: 0;
  `}
`;

const JsonIndent = styled.div`
  ${({ theme }) => `
    padding-left: ${theme.sizeUnit * 4}px;
  `}
`;

const JsonKey = styled.span`
  ${({ theme }) => `
    color: ${theme.colorText};
    flex: none;
  `}
`;

const JsonMuted = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
  `}
`;

const StringValue = styled.span`
  ${({ theme }) => `
    color: ${theme.colorSuccess};
  `}
`;

const NumberValue = styled.span`
  ${({ theme }) => `
    color: ${theme.colorPrimary};
  `}
`;

const BooleanValue = styled.span`
  ${({ theme }) => `
    color: ${theme.colorWarning};
  `}
`;

const Tree = styled.div`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    white-space: pre-wrap;
    word-break: break-word;
  `}
`;

// AG Grid selects the row from a listener on the row container. React's
// delegated click handler runs at the React root, after that listener, so the
// control stops the native event on the button itself.
const AG_GRID_STOP_PROPAGATION = '__ag_Grid_Stop_Propagation';

function stopGridPointer(event: Event) {
  event.stopPropagation();
  Object.assign(event, { [AG_GRID_STOP_PROPAGATION]: true });
}

function JsonActionButton({
  label,
  expanded,
  onActivate,
  testId,
  opensDialog = false,
  children,
}: {
  label?: string;
  expanded?: boolean;
  onActivate: () => void;
  testId?: string;
  opensDialog?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const stop = (event: Event) => {
      stopGridPointer(event);
    };
    const onClick = (event: Event) => {
      stopGridPointer(event);
      onActivate();
    };
    node.addEventListener('pointerdown', stop);
    node.addEventListener('mousedown', stop);
    node.addEventListener('click', onClick);
    node.addEventListener('dblclick', stop);
    return () => {
      node.removeEventListener('pointerdown', stop);
      node.removeEventListener('mousedown', stop);
      node.removeEventListener('click', onClick);
      node.removeEventListener('dblclick', stop);
    };
  }, [onActivate]);

  return (
    <JsonToggle
      ref={ref}
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      data-json-cell-action
      data-json-cell-open={opensDialog ? '' : undefined}
      data-test={testId}
    >
      {children}
    </JsonToggle>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <StringValue>{JSON.stringify(value)}</StringValue>;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return <NumberValue>{String(value)}</NumberValue>;
  }
  if (typeof value === 'boolean') {
    return <BooleanValue>{String(value)}</BooleanValue>;
  }
  if (value === null) {
    return <JsonMuted>null</JsonMuted>;
  }
  return <JsonMuted>{String(value)}</JsonMuted>;
}

function containerEntries(
  value: JsonContainer,
): Array<readonly [string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((item, index) => [String(index), item] as const);
  }
  return Object.entries(value);
}

function containerSummary(value: JsonContainer): string {
  if (Array.isArray(value)) {
    return tn('%s item', '%s items', value.length, value.length);
  }
  const keyCount = Object.keys(value).length;
  return tn('%s key', '%s keys', keyCount, keyCount);
}

function JsonNode({
  value,
  name,
  depth,
  initialOpen = false,
  onLayoutChange,
}: {
  value: unknown;
  name?: string;
  depth: number;
  initialOpen?: boolean;
  onLayoutChange?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const isContainer =
    value !== null &&
    typeof value === 'object' &&
    (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

  if (!isContainer || depth >= MAX_JSON_DEPTH) {
    return (
      <JsonLine>
        {name !== undefined && <JsonKey>{name}: </JsonKey>}
        {isContainer ? (
          <JsonMuted>…</JsonMuted>
        ) : (
          <JsonPrimitive value={value} />
        )}
      </JsonLine>
    );
  }

  const container = value as JsonContainer;
  const entries = containerEntries(container);
  const openBrace = Array.isArray(container) ? '[' : '{';
  const closeBrace = Array.isArray(container) ? ']' : '}';
  const label = name !== undefined ? name : 'JSON';
  const actionLabel = open ? t('Collapse %s', label) : t('Expand %s', label);

  return (
    <JsonBlock>
      <JsonLine>
        <JsonActionButton
          label={actionLabel}
          expanded={open}
          onActivate={() => {
            setOpen(current => !current);
            onLayoutChange?.();
          }}
        >
          {open ? (
            <Icons.CaretDownOutlined iconSize="xs" />
          ) : (
            <Icons.CaretRightOutlined iconSize="xs" />
          )}
        </JsonActionButton>
        {name !== undefined && <JsonKey>{name}: </JsonKey>}
        <span>{openBrace}</span>
        {!open && (
          <>
            <JsonMuted>{containerSummary(container)}</JsonMuted>
            <span>{closeBrace}</span>
          </>
        )}
      </JsonLine>
      {open && (
        <>
          <JsonIndent>
            {entries.map(([key, child]) => (
              <JsonNode
                key={key}
                name={key}
                value={child}
                depth={depth + 1}
                onLayoutChange={onLayoutChange}
              />
            ))}
          </JsonIndent>
          <JsonLine>{closeBrace}</JsonLine>
        </>
      )}
    </JsonBlock>
  );
}

export function JsonCellRenderer({
  value,
  rawText,
  colId,
  autoHeight,
  wrapText = false,
  jsonInCell = false,
  api,
  node,
  eGridCell,
}: JsonCellRendererProps) {
  const [expanded, setExpanded] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAdjustedHeight = useRef(false);
  const latest = useRef({
    expanded,
    autoHeight,
    api,
    node,
    colId,
  });

  const showTree = jsonInCell && expanded;
  const wrapPreview = wrapText && !jsonInCell;
  const dataWrap = wrapPreview ? 'true' : 'false';
  const preview = useMemo(() => {
    if (!wrapPreview) {
      return jsonCellPreview(value, rawText);
    }
    if (rawText !== undefined) {
      return rawText;
    }
    return jsonCellWrappedText(value);
  }, [rawText, value, wrapPreview]);
  const openBrace = Array.isArray(value) ? '[' : '{';
  const closeBrace = Array.isArray(value) ? ']' : '}';

  const bumpLayout = useCallback(() => {
    setLayoutTick(tick => tick + 1);
  }, []);

  useLayoutEffect(() => {
    latest.current = { expanded: showTree, autoHeight, api, node, colId };
    const cell = eGridCell ?? null;
    cell?.classList.toggle('json-cell-expanded', showTree);

    const shouldSync = showTree || hasAdjustedHeight.current;
    const setRowHeight = node?.setRowHeight;
    const onRowHeightChanged = api?.onRowHeightChanged;
    if (shouldSync && !api?.isDestroyed?.()) {
      hasAdjustedHeight.current = showTree;
      if (autoHeight) {
        api?.resetRowHeights?.();
      } else if (node && setRowHeight && onRowHeightChanged) {
        const measured = rootRef.current?.scrollHeight ?? 0;
        const height =
          showTree && measured > 0 ? measured + JSON_CELL_ROW_CHROME_PX : 0;
        syncJsonCellRowHeight(node, onRowHeightChanged, colId, height);
      }
    }

    return () => {
      cell?.classList.remove('json-cell-expanded');
    };
  }, [api, autoHeight, colId, eGridCell, layoutTick, node, showTree]);

  const openJsonModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded(current => !current);
  }, []);

  useEffect(
    () => () => {
      const { current } = latest;
      const {
        expanded: wasExpanded,
        autoHeight: wasAutoHeight,
        api: gridApi,
        node: rowNode,
        colId: columnId,
      } = current;
      const setRowHeight = rowNode?.setRowHeight;
      const onRowHeightChanged = gridApi?.onRowHeightChanged;
      if (!wasExpanded || gridApi?.isDestroyed?.()) {
        return;
      }
      if (wasAutoHeight) {
        gridApi?.resetRowHeights?.();
        return;
      }
      if (rowNode && setRowHeight && onRowHeightChanged) {
        syncJsonCellRowHeight(rowNode, onRowHeightChanged, columnId, 0);
      }
    },
    [],
  );

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyText = useCallback(async () => {
    const text = rawText ?? JSON.stringify(value, null, 2);
    try {
      if (!navigator.clipboard?.writeText) {
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [rawText, value]);

  return (
    <Root ref={rootRef} data-test="json-cell">
      <Toolbar data-wrap={dataWrap}>
        {jsonInCell && (
          <JsonActionButton
            label={expanded ? t('Collapse JSON') : t('Expand JSON')}
            expanded={expanded}
            testId="json-cell-expand"
            onActivate={toggleExpanded}
          >
            {expanded ? (
              <Icons.CaretDownOutlined iconSize="xs" />
            ) : (
              <Icons.CaretRightOutlined iconSize="xs" />
            )}
          </JsonActionButton>
        )}
        <ToolbarMain>
          {showTree ? (
            <span>{openBrace}</span>
          ) : (
            <Preview
              data-test="json-cell-preview"
              data-wrap={dataWrap}
              title={
                preview.length <= PREVIEW_TITLE_MAX_LENGTH ? preview : undefined
              }
            >
              {preview}
            </Preview>
          )}
        </ToolbarMain>
        <JsonActionButton
          label={t('Open JSON')}
          testId="json-cell-open"
          opensDialog
          onActivate={openJsonModal}
        >
          <Icons.FullscreenOutlined iconSize="xs" />
        </JsonActionButton>
      </Toolbar>
      {showTree && (
        <>
          <JsonIndent>
            {containerEntries(value).map(([key, child]) => (
              <JsonNode
                key={key}
                name={key}
                value={child}
                depth={1}
                onLayoutChange={bumpLayout}
              />
            ))}
          </JsonIndent>
          <span>{closeBrace}</span>
        </>
      )}
      <Modal
        show={modalOpen}
        onHide={() => {
          setModalOpen(false);
          setCopied(false);
        }}
        title={t('Cell content')}
        width="800px"
        maxWidth="90vw"
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
        footer={[
          <Button
            key="copy"
            buttonStyle="secondary"
            data-test="json-cell-copy"
            aria-label={copied ? t('Copied') : t('Copy')}
            onClick={() => {
              copyText().catch(() => setCopied(false));
            }}
          >
            <Icons.CopyOutlined iconSize="s" aria-hidden />
            {copied ? t('Copied') : t('Copy')}
          </Button>,
        ]}
      >
        <Tree>
          <JsonNode value={value} depth={0} initialOpen />
        </Tree>
      </Modal>
    </Root>
  );
}
