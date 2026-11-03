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
import { useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { css, useTheme } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Icons, Input, Tooltip } from '@superset-ui/core/components';
import { EncryptedExtraHint, EncryptedExtraSecretField } from '../types';
import { StyledInputContainer } from './styles';

const BULLETS = '•'.repeat(20);
const MASK = 'XXXXXXXXXX';

// StyledInputContainer borders every text input; inside the affix wrapper
// that would draw a second box, so restore antd's affixed input defaults.
// Inter's contextual alternates would restyle the bullets next to the ending.
// The bullets are the prefix, flush with the value so they read as one run.
const INPUT_STYLES = {
  input: { borderWidth: 0, padding: 0, fontVariantLigatures: 'no-contextual' },
  prefix: { marginInlineEnd: 0, fontVariantLigatures: 'no-contextual' },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Lists the masked values of a Secure extra JSON that sit at the engine's
 * declared sensitive paths (`$.a.b`, with `*` matching every key of a level).
 * A masked parent of a declared path is listed as that path, and a wildcard
 * match is dropped when a listed path sits under it. A path matched by both a
 * wildcard and a concrete declaration takes the concrete label.
 */
export const resolveMaskedSecretFields = (
  maskedEncryptedExtra: string | undefined,
  sensitiveFields: Record<string, string>,
): EncryptedExtraSecretField[] => {
  let payload: unknown;
  try {
    payload = JSON.parse(maskedEncryptedExtra ?? '');
  } catch {
    return [];
  }
  if (!isRecord(payload)) {
    return [];
  }
  const fields = new Map<string, { label: string; wildcard: boolean }>();
  Object.entries(sensitiveFields).forEach(([declared, label]) => {
    const segments = declared.split('.').slice(1);
    const wildcard = segments.includes('*');
    let matches: [string, unknown][] = [['$', payload]];
    segments.forEach(segment => {
      matches = matches.flatMap(([path, value]): [string, unknown][] => {
        // A masked parent hides a declared leaf, and the server hints at that leaf.
        if (!wildcard && value === MASK) {
          return [[declared, value]];
        }
        if (!isRecord(value)) {
          return [];
        }
        return segment === '*'
          ? Object.entries(value).map(([key, child]) => [
              `${path}.${key}`,
              child,
            ])
          : [[`${path}.${segment}`, value[segment]]];
      });
    });
    matches.forEach(([path, value]) => {
      const known = fields.get(path);
      // A concrete path keeps its own label over a wildcard's.
      if (value === MASK && (!known || (known.wildcard && !wildcard))) {
        fields.set(path, { label, wildcard });
      }
    });
  });
  const paths = Array.from(fields.keys());
  return Array.from(fields)
    .filter(
      ([path, { wildcard }]) =>
        !wildcard || !paths.some(other => other.startsWith(`${path}.`)),
    )
    .map(([path, { label }]) => ({ path, label }));
};

// One request serves every field; an error's `path` is the eye that sent it.
type HintsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; hints: EncryptedExtraHint[] }
  | { status: 'error'; path: string };

const SecureExtraHints = ({
  databaseId,
  fields,
  minLength,
}: {
  databaseId: number;
  fields: EncryptedExtraSecretField[];
  // Shortest secret whose ending the server reveals.
  minLength: number;
}) => {
  const theme = useTheme();
  // Same colours as antd's password field eye.
  const eyeIconStyles = css`
    color: ${theme.colorIcon};
    &:hover {
      color: ${theme.colorIconHover};
    }
  `;
  const showIcon = <Icons.EyeOutlined iconSize="m" css={eyeIconStyles} />;
  const hideIcon = (
    <Icons.EyeInvisibleOutlined iconSize="m" css={eyeIconStyles} />
  );
  const [state, setState] = useState<HintsState>({ status: 'idle' });
  // Paths whose eye is open; each shows once the hints are loaded.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  // A field that leaves the editor closes its eye, so it comes back hidden.
  const pathsKey = JSON.stringify(fields.map(({ path }) => path));
  const [seenPathsKey, setSeenPathsKey] = useState(pathsKey);
  if (seenPathsKey !== pathsKey) {
    setSeenPathsKey(pathsKey);
    const paths = new Set(fields.map(({ path }) => path));
    setRevealed(
      current => new Set(Array.from(current).filter(path => paths.has(path))),
    );
  }
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Set on every run: strict mode and fast refresh rerun effects after cleanup.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchHints = (path: string) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setState({ status: 'loading' });
    SupersetClient.get({
      endpoint: `/api/v1/database/${databaseId}/encrypted_extra_hints/`,
    })
      .then(({ json }) => {
        if (mounted.current) {
          setState({ status: 'loaded', hints: json?.result ?? [] });
        }
      })
      .catch(() => {
        if (mounted.current) {
          setState({ status: 'error', path });
          setRevealed(new Set());
        }
      })
      .finally(() => {
        inFlight.current = false;
      });
  };

  // Shows or hides one field; the first show fetches every ending once.
  const setShown = (path: string, show: boolean) => {
    if (!show) {
      setRevealed(current => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      return;
    }
    setRevealed(current => new Set(current).add(path));
    if (state.status !== 'loaded') {
      fetchHints(path);
    }
  };

  // Shown on the right of a revealed field that has no ending to show.
  const note = (hint: EncryptedExtraHint | undefined) => {
    if (!hint) {
      return t('Not available');
    }
    if (hint.suffix !== null) {
      return undefined;
    }
    return (
      <Tooltip
        title={t(
          'Only the ending of secrets with at least %s characters is shown.',
          minLength,
        )}
      >
        <span>{t('Too short to show safely')}</span>
      </Tooltip>
    );
  };

  // Label, helper and bullets never change; a reveal unmasks only the ending.
  return (
    <div data-test="secure-extra-hints">
      {fields.map(({ path, label }) => {
        const shown = state.status === 'loaded' && revealed.has(path);
        const hint = shown
          ? state.hints.find(candidate => candidate.path === path)
          : undefined;
        // Every eye waiting on the request shows the spinner in the slot.
        const loading = state.status === 'loading' && revealed.has(path);
        const slot = loading ? (
          <Icons.LoadingOutlined iconSize="m" />
        ) : shown ? (
          note(hint)
        ) : undefined;
        return (
          <StyledInputContainer key={path} data-test="secure-extra-hint">
            <div className="control-label">{label}</div>
            <div className="input-container">
              <Input.Password
                data-test="secure-extra-hint-input"
                aria-label={label}
                readOnly
                prefix={<span aria-hidden>{BULLETS}</span>}
                // Only a revealed field holds its ending; a hidden one is empty,
                // so the page never carries a hidden ending.
                value={hint?.suffix ?? ''}
                // antd's toggle is the eye: focusable, Enter and Space, pressed state.
                visibilityToggle={{
                  visible: shown,
                  onVisibleChange: next => setShown(path, next),
                }}
                iconRender={visible => (visible ? hideIcon : showIcon)}
                count={slot ? { show: () => slot } : undefined}
                styles={INPUT_STYLES}
              />
            </div>
            {state.status === 'error' && state.path === path && (
              <Alert
                type="warning"
                showIcon
                closable={false}
                message={t('Could not load the stored secrets. Try again.')}
              />
            )}
            <div className="helper">
              {t(
                'Stored at %s. Edits to Secure extra above are not reflected until saved.',
                path.replace(/^\$\./, ''),
              )}
            </div>
          </StyledInputContainer>
        );
      })}
    </div>
  );
};

export default SecureExtraHints;
