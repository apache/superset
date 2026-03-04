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
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/ui';

import 'ace-builds/src-min-noconflict/mode-handlebars';

import ControlHeader from 'src/explore/components/ControlHeader';

interface HotkeyConfig {
  name: string;
  key: string;
  func: () => void;
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
  initialValue = '',
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

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current.cancel();
      }
    },
    [],
  );

  const handleChange = useCallback(
    (val: string | { target: { value: string } }) => {
      const finalValue = typeof val === 'object' ? val.target.value : val;
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current(finalValue);
      } else {
        onChange?.(finalValue);
      }
    },
    [onChange],
  );

  const onEditorLoad = useCallback(
    (editor: {
      commands: {
        addCommand: (cmd: {
          name: string;
          bindKey: { win: string; mac: string };
          exec: () => void;
        }) => void;
      };
    }) => {
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
        }

        if (readOnly) {
          style.backgroundColor = theme?.colorBgMask;
        }

        const codeEditor = (
          <div>
            <TextAreaEditor
              mode={language}
              style={style}
              minLines={effectiveMinLines}
              maxLines={inModal ? 1000 : maxLines}
              editorProps={{ $blockScrolling: true }}
              onLoad={onEditorLoad}
              defaultValue={initialValue}
              readOnly={readOnly}
              key={name}
              {...restProps}
              onChange={handleChange}
            />
          </div>
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
            defaultValue={initialValue}
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
      name,
      restProps,
      handleChange,
      tooltipOptions,
      height,
      ariaRequired,
    ],
  );

  // Extract only ControlHeader-compatible props from restProps
  const {
    label,
    description,
    validationErrors,
    renderTrigger,
    rightNode,
    leftNode,
    onClick,
    hovered,
    tooltipOnClick,
    warning,
    danger,
  } = restProps as Record<string, unknown>;

  const controlHeader = useMemo(
    () => (
      <ControlHeader
        name={name}
        label={label as React.ReactNode}
        description={description as React.ReactNode}
        validationErrors={validationErrors as string[] | undefined}
        renderTrigger={renderTrigger as boolean | undefined}
        rightNode={rightNode as React.ReactNode}
        leftNode={leftNode as React.ReactNode}
        onClick={onClick as (() => void) | undefined}
        hovered={hovered as boolean | undefined}
        tooltipOnClick={tooltipOnClick as (() => void) | undefined}
        warning={warning as string | undefined}
        danger={danger as string | undefined}
      />
    ),
    [
      name,
      label,
      description,
      validationErrors,
      renderTrigger,
      rightNode,
      leftNode,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    ],
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
          modalTitle={String(label || '')}
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
