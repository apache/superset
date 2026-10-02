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
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Icons, Modal } from '@superset-ui/core/components';
import { type JsonContainer, jsonCellPreview } from './parseJsonCellValue';
import { syncJsonCellRowHeight } from './jsonCellRowHeight';

const MAX_JSON_DEPTH = 32;
const JSON_CELL_ROW_CHROME_PX = 12;
const ARROW_CLICK_MS = 250;

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
  `}
`;

const Preview = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
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

const TextToggle = styled.button`
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
  white-space: inherit;
  word-break: inherit;
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
  display: flex;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
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
  plain = false,
  testId,
  children,
}: {
  label?: string;
  expanded?: boolean;
  onActivate: () => void;
  plain?: boolean;
  testId?: string;
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

  const Toggle = plain ? TextToggle : JsonToggle;
  return (
    <Toggle
      ref={ref}
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      data-json-cell-action
      data-test={testId}
    >
      {children}
    </Toggle>
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
    return t('%s items', value.length);
  }
  return t('%s keys', Object.keys(value).length);
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
  const arrowClickTimer = useRef<number | undefined>(undefined);
  const hasAdjustedHeight = useRef(false);
  const latest = useRef({
    expanded,
    autoHeight,
    api,
    node,
    colId,
  });

  const showTree = jsonInCell && expanded;
  const preview = jsonCellPreview(value, rawText);
  const originalText = rawText ?? JSON.stringify(value);
  const openBrace = Array.isArray(value) ? '[' : '{';
  const closeBrace = Array.isArray(value) ? ']' : '}';
  const entries = containerEntries(value);

  const bumpLayout = useCallback(() => {
    setLayoutTick(tick => tick + 1);
  }, []);

  useLayoutEffect(() => {
    latest.current = { expanded: showTree, autoHeight, api, node, colId };
    const cell = eGridCell ?? null;
    cell?.classList.toggle('json-cell-expanded', showTree);

    const shouldSync = showTree || hasAdjustedHeight.current;
    const setRowHeight = node?.setRowHeight;
    if (shouldSync && !api?.isDestroyed?.()) {
      hasAdjustedHeight.current = showTree;
      if (autoHeight) {
        api?.resetRowHeights?.();
      } else if (setRowHeight && api?.onRowHeightChanged) {
        const measured = rootRef.current?.scrollHeight ?? 0;
        const height =
          showTree && measured > 0 ? measured + JSON_CELL_ROW_CHROME_PX : 0;
        syncJsonCellRowHeight(
          { setRowHeight },
          { onRowHeightChanged: () => api.onRowHeightChanged?.() },
          colId,
          height,
        );
      }
    }

    return () => {
      cell?.classList.remove('json-cell-expanded');
    };
  }, [api, autoHeight, colId, eGridCell, layoutTick, node, showTree]);

  useEffect(
    () => () => {
      if (arrowClickTimer.current !== undefined) {
        window.clearTimeout(arrowClickTimer.current);
      }
    },
    [],
  );

  const onArrowClick = useCallback(() => {
    if (arrowClickTimer.current !== undefined) {
      window.clearTimeout(arrowClickTimer.current);
      arrowClickTimer.current = undefined;
      setModalOpen(true);
      return;
    }
    arrowClickTimer.current = window.setTimeout(() => {
      arrowClickTimer.current = undefined;
      setExpanded(current => !current);
    }, ARROW_CLICK_MS);
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
      if (!wasExpanded || gridApi?.isDestroyed?.()) {
        return;
      }
      if (wasAutoHeight) {
        gridApi?.resetRowHeights?.();
        return;
      }
      if (setRowHeight && gridApi?.onRowHeightChanged) {
        syncJsonCellRowHeight(
          { setRowHeight },
          { onRowHeightChanged: () => gridApi.onRowHeightChanged?.() },
          columnId,
          0,
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
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
      {jsonInCell ? (
        <Toolbar>
          <JsonActionButton
            label={expanded ? t('Collapse JSON') : t('Expand JSON')}
            expanded={expanded}
            testId="json-cell-expand"
            onActivate={onArrowClick}
          >
            {expanded ? (
              <Icons.CaretDownOutlined iconSize="xs" />
            ) : (
              <Icons.CaretRightOutlined iconSize="xs" />
            )}
          </JsonActionButton>
          {!expanded && (
            <Preview
              data-test="json-cell-preview"
              title={preview.length <= 500 ? preview : undefined}
            >
              {preview}
            </Preview>
          )}
          {expanded && <span>{openBrace}</span>}
        </Toolbar>
      ) : (
        <JsonActionButton
          plain
          testId="json-cell-preview"
          onActivate={() => setModalOpen(true)}
        >
          {originalText}
        </JsonActionButton>
      )}
      {showTree && (
        <>
          <JsonIndent>
            {entries.map(([key, child]) => (
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
