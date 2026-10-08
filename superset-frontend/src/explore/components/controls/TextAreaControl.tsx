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
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { debounce } from 'lodash-es';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import 'ace-builds/src-min-noconflict/mode-handlebars';

import ControlHeader from 'src/explore/components/ControlHeader';

interface HotkeyConfig {
  name: string;
  key: string;
  descr?: string;
  func: () => void;
}

interface AceEditorHandle {
  commands: {
    addCommand: (cmd: {
      name: string;
      bindKey: { win: string; mac: string };
      exec: () => void;
    }) => void;
  };
  getValue: () => string;
  setValue: (value: string, cursorPos?: number) => void;
  getCursorPosition: () => { row: number; column: number };
  moveCursorToPosition: (pos: { row: number; column: number }) => void;
  clearSelection: () => void;
}

// The inline editor and the "edit in modal" editor are two Ace instances
// showing the same value; the modal one is unmounted (destroyOnHidden) each
// time the modal closes. Clearing the matching ref on unmount stops a later
// external sync from calling methods on that destroyed instance.
function EditorUnmountGuard({
  targetRef,
  children,
}: {
  targetRef: MutableRefObject<AceEditorHandle | null>;
  children: ReactNode;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- targetRef is a
  // stable useRef object; run only on mount/unmount, not on every render.
  useEffect(
    () => () => {
      targetRef.current = null;
    },
    [],
  );
  return <>{children}</>;
}

interface TextAreaControlProps {
  name?: string;
  onChange?: (value: string) => void;
  initialValue?: string;
  height?: number;
  minLines?: number;
  maxLines?: number;
  offerEditInModal?: boolean;
  language?:
    | 'json'
    | 'html'
    | 'sql'
    | 'markdown'
    | 'javascript'
    | 'handlebars'
    | null;
  aboveEditorSection?: React.ReactNode;
  readOnly?: boolean;
  resize?:
    | 'block'
    | 'both'
    | 'horizontal'
    | 'inline'
    | 'none'
    | 'vertical'
    | null;
  textAreaStyles?: React.CSSProperties;
  tooltipOptions?: Record<string, unknown>;
  hotkeys?: HotkeyConfig[];
  debounceDelay?: number | null;
  'aria-required'?: boolean;
  value?: string;
  [key: string]: unknown;
}

function TextAreaControl({
  name,
  onChange = () => {},
  initialValue,
  height = 250,
  minLines = 3,
  maxLines = 10,
  offerEditInModal = true,
  language,
  aboveEditorSection,
  readOnly = false,
  resize = null,
  textAreaStyles = {},
  tooltipOptions = {},
  hotkeys = [],
  debounceDelay = null,
  'aria-required': ariaRequired,
  value,
  ...restProps
}: TextAreaControlProps) {
  const theme = useTheme();

  // The inline editor and the "edit in modal" editor are tracked separately:
  // both can be mounted at once (modal open), and the modal instance is
  // unmounted/remounted independently of the inline one, so a single shared
  // ref would end up pointing at whichever loaded last (see
  // EditorUnmountGuard above for the unmount half of this).
  const inlineEditorRef = useRef<AceEditorHandle | null>(null);
  const modalEditorRef = useRef<AceEditorHandle | null>(null);
  // Tracks the value each Ace editor's own buffer currently holds, so an
  // `initialValue` prop change caused by the user's own typing (echoed back
  // through onChange) can be told apart from a genuinely external update
  // (e.g. a "sync from source" action elsewhere). Only the latter should
  // push an imperative setValue(); doing it unconditionally would reset the
  // cursor to the end of the document on every keystroke.
  const lastInlineValueRef = useRef<string | undefined>(initialValue ?? value);
  const lastModalValueRef = useRef<string | undefined>(initialValue ?? value);
  // Ace's setValue() fires its normal change event, so the imperative sync
  // below would otherwise echo straight back out through onChange and look
  // like the user just typed the synced value. Set while that call is in
  // flight so handleChange can tell the echo apart from a real edit.
  const isSyncingRef = useRef(false);

  const debouncedOnChangeRef = useRef<ReturnType<
    typeof debounce<(value: string) => void>
  > | null>(null);

  // Create or update debounced onChange when dependencies change
  useEffect(() => {
    if (debounceDelay && onChange) {
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current.cancel();
      }
      debouncedOnChangeRef.current = debounce(onChange, debounceDelay);
    } else {
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current.cancel();
      }
      debouncedOnChangeRef.current = null;
    }
  }, [onChange, debounceDelay]);

  // Cleanup on unmount — flush pending debounced onChange so last edit isn't lost
  useEffect(
    () => () => {
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current.flush();
      }
    },
    [],
  );

  // `inModal` tells us which editor's buffer this edit came from, so only
  // that editor's "last known value" is marked as seen — the other editor
  // (inline or modal) still looks stale to the sync effect below and picks
  // the edit up too, keeping both presentations of the same value in sync.
  const handleChange = useCallback(
    (val: string | { target: { value: string } }, inModal = false) => {
      const finalValue = typeof val === 'object' ? val.target.value : val;
      (inModal ? lastModalValueRef : lastInlineValueRef).current = finalValue;
      if (isSyncingRef.current) {
        // This change event is the echo of our own imperative setValue()
        // during an external sync, not the user typing; don't re-notify
        // the parent with the value it just sent down.
        return;
      }
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current(finalValue);
      } else {
        onChange?.(finalValue);
      }
    },
    [onChange],
  );

  const onEditorLoad = useCallback(
    (editor: AceEditorHandle, inModal = false) => {
      const ref = inModal ? modalEditorRef : inlineEditorRef;
      const lastValueRef = inModal ? lastModalValueRef : lastInlineValueRef;
      ref.current = editor;
      // Loading the Ace module is async, so by the time this fires
      // `initialValue`/`value` may have already moved past whatever was
      // captured when this ref was created; read the buffer's actual
      // mounted content instead of trusting that stale snapshot.
      lastValueRef.current = editor.getValue();
      hotkeys?.forEach(keyConfig => {
        editor.commands.addCommand({
          name: keyConfig.name,
          bindKey: { win: keyConfig.key, mac: keyConfig.key },
          exec: keyConfig.func,
        });
      });
    },
    [hotkeys],
  );

  // Pick up an `initialValue` change that didn't originate from either
  // editor's own typing (handleChange above would have already updated the
  // relevant lastValueRef for that case), without remounting the Ace
  // instance or losing the user's current cursor position. Runs against
  // both editors independently since either, both, or neither may be
  // mounted at a given time.
  useEffect(() => {
    const nextValue = initialValue ?? value;
    if (nextValue === undefined) {
      return;
    }
    const syncEditor = (
      editor: AceEditorHandle | null,
      lastValueRef: MutableRefObject<string | undefined>,
    ) => {
      if (
        editor &&
        nextValue !== lastValueRef.current &&
        nextValue !== editor.getValue()
      ) {
        const cursorPos = editor.getCursorPosition();
        isSyncingRef.current = true;
        editor.setValue(nextValue, 1);
        isSyncingRef.current = false;
        editor.clearSelection();
        editor.moveCursorToPosition(cursorPos);
        lastValueRef.current = nextValue;
      }
    };
    syncEditor(inlineEditorRef.current, lastInlineValueRef);
    syncEditor(modalEditorRef.current, lastModalValueRef);
  }, [initialValue, value]);

  const renderEditor = useCallback(
    (inModal = false) => {
      const effectiveMinLines = inModal ? 40 : minLines || 12;

      if (language) {
        const style: React.CSSProperties = {
          border: theme?.colorBorder
            ? `1px solid ${theme.colorBorder}`
            : undefined,
          minHeight: `${effectiveMinLines}em`,
          width: 'auto',
          ...textAreaStyles,
        };

        if (resize) {
          style.resize = resize;
          style.overflow = 'auto';
        }

        if (readOnly) {
          style.backgroundColor = theme?.colorBgMask;
        }

        const codeEditor = (
          <EditorUnmountGuard
            targetRef={inModal ? modalEditorRef : inlineEditorRef}
          >
            <div>
              <TextAreaEditor
                mode={language}
                style={style}
                minLines={effectiveMinLines}
                maxLines={inModal ? 1000 : maxLines}
                editorProps={{ $blockScrolling: true }}
                onLoad={(editor: AceEditorHandle) =>
                  onEditorLoad(editor, inModal)
                }
                defaultValue={initialValue ?? value}
                readOnly={readOnly}
                key={name}
                {...restProps}
                onChange={(val: string | { target: { value: string } }) =>
                  handleChange(val, inModal)
                }
              />
            </div>
          </EditorUnmountGuard>
        );

        if (tooltipOptions && Object.keys(tooltipOptions).length > 0) {
          return <Tooltip {...tooltipOptions}>{codeEditor}</Tooltip>;
        }
        return codeEditor;
      }

      const textArea = (
        <div>
          <Input.TextArea
            placeholder={t('textarea')}
            onChange={handleChange}
            defaultValue={initialValue ?? value}
            disabled={readOnly}
            style={{ height }}
            aria-required={ariaRequired}
          />
        </div>
      );

      if (tooltipOptions && Object.keys(tooltipOptions).length > 0) {
        return <Tooltip {...tooltipOptions}>{textArea}</Tooltip>;
      }
      return textArea;
    },
    [
      minLines,
      maxLines,
      language,
      theme,
      textAreaStyles,
      resize,
      readOnly,
      onEditorLoad,
      initialValue,
      value,
      name,
      restProps,
      handleChange,
      tooltipOptions,
      height,
      ariaRequired,
    ],
  );

  // Pass restProps directly to ControlHeader. The same pattern is used by
  // ViewportControl elsewhere in this PR — listing every ControlHeader prop
  // explicitly was a literal port of `this.props` access from the class
  // version, but for a pure FC `{...restProps}` is equivalent and avoids the
  // dep-array drift that a 12-key destructure tends to invite.
  const controlHeader = useMemo(
    () => <ControlHeader name={name} {...restProps} />,
    [name, restProps],
  );

  const modalBody = useMemo(
    () => (
      <>
        <div>{aboveEditorSection}</div>
        {renderEditor(true)}
      </>
    ),
    [aboveEditorSection, renderEditor],
  );

  return (
    <div>
      {controlHeader}
      {renderEditor()}
      {offerEditInModal && (
        <ModalTrigger
          modalTitle={controlHeader}
          triggerNode={
            <Button
              buttonSize="small"
              style={{ marginTop: theme?.sizeUnit ?? 4 }}
            >
              {t('Edit %s in modal', language)}
            </Button>
          }
          modalBody={modalBody}
          responsive
        />
      )}
    </div>
  );
}

export default TextAreaControl;
