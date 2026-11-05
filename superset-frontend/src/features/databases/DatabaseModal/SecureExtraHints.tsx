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
import {
  Button,
  Icons,
  Input,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { EncryptedExtraHint, EncryptedExtraSecretField } from '../types';
import { isExpiringSoon } from './expiry';
import { StyledInputContainer } from './styles';

const BULLETS = '•'.repeat(20);
const MASK = 'XXXXXXXXXX';

// StyledInputContainer borders every text input; inside the affix wrapper
// that would draw a second box, so restore antd's affixed input defaults.
// Inter's contextual alternates would restyle the bullets before the suffix.
const INPUT_STYLES = {
  input: { borderWidth: 0, padding: 0, fontVariantLigatures: 'no-contextual' },
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
  const expiryStyles = css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
  `;
  const [state, setState] = useState<HintsState>({ status: 'idle' });
  // Paths whose eye is open; each shows once the hints are loaded.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
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

  const toggle = (path: string) => {
    if (state.status === 'loaded' && revealed.has(path)) {
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

  const eye = (path: string, shown: boolean) => {
    const toggleLabel = shown
      ? t('Hide stored secret.')
      : t('Show stored secret.');
    return (
      <Tooltip title={toggleLabel}>
        <Button
          buttonStyle="link"
          buttonSize="small"
          aria-label={toggleLabel}
          // Every eye waiting on the request spins.
          loading={state.status === 'loading' && revealed.has(path)}
          // As the icon prop, the loading spinner replaces it instead of widening the button.
          icon={
            shown ? (
              <Icons.EyeInvisibleOutlined iconSize="m" css={eyeIconStyles} />
            ) : (
              <Icons.EyeOutlined iconSize="m" css={eyeIconStyles} />
            )
          }
          onClick={event => {
            // The affix wrapper focuses its input on any click inside it.
            event.stopPropagation();
            toggle(path);
          }}
        />
      </Tooltip>
    );
  };

  // A JWT's expiry; the server decides whether it has passed.
  const expiry = ({ expires_at: expiresAt, expired }: EncryptedExtraHint) => {
    if (!expiresAt) {
      return undefined;
    }
    const date = extendedDayjs(expiresAt).format('ll');
    // The icon carries the severity; the text keeps a readable colour.
    const soon = !expired && isExpiringSoon(expiresAt);
    return (
      <Tooltip title={t("Read from the token's exp claim.")}>
        <span css={expiryStyles}>
          {(expired || soon) && (
            <Icons.ExclamationCircleFilled
              iconSize="s"
              iconColor={expired ? theme.colorError : theme.colorWarning}
              aria-hidden
            />
          )}
          {expired ? (
            <Typography.Text type="danger">
              {t('Expired %s', date)}
            </Typography.Text>
          ) : (
            <Typography.Text type={soon ? undefined : 'secondary'}>
              {t('Expires %s', date)}
            </Typography.Text>
          )}
        </span>
      </Tooltip>
    );
  };

  // Shown on the right of a revealed field: why its ending is missing, or else
  // when it expires.
  const note = (hint: EncryptedExtraHint | undefined) => {
    if (!hint) {
      return t('Not available');
    }
    if (hint.suffix !== null) {
      return expiry(hint);
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

  // Label and helper never change; a reveal swaps only the value and eye.
  return (
    <div data-test="secure-extra-hints">
      {fields.map(({ path, label }) => {
        const shown = state.status === 'loaded' && revealed.has(path);
        const hint = shown
          ? state.hints.find(candidate => candidate.path === path)
          : undefined;
        const slot = shown ? note(hint) : undefined;
        return (
          <StyledInputContainer key={path} data-test="secure-extra-hint">
            <div className="control-label">{label}</div>
            <div className="input-container">
              <Input
                data-test="secure-extra-hint-input"
                aria-label={label}
                readOnly
                type="text"
                value={`${BULLETS}${hint?.suffix ?? ''}`}
                suffix={eye(path, shown)}
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
