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

import { useMemo } from 'react';
import { styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { CanvasDefinition, CdlFilter, CdlNode, Primitive } from './types';
import { MANIFEST } from './manifest';
import { runActions } from './actions';
import { resolveVars } from './resolve';
import { resolveStyle } from './style';
import {
  FilterProvider,
  QueryRunner,
  QueryRunnerProvider,
  UiStateProvider,
  VariableProvider,
  VariableProviderProps,
  useFilters,
  useUiState,
  useVariables,
} from './runtime';
import { validateCanvas, ValidationError } from './validator';

const InvalidNode = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border: 1px solid ${({ theme }) => theme.colorErrorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  color: ${({ theme }) => theme.colorError};
  font-family: ${({ theme }) => theme.fontFamilyCode};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

/** The recursive resolver: catalog lookup, prop/bind/event wiring, recursion. */
function NodeRenderer({ node }: { node: CdlNode }) {
  const { vars, decls, setVariable, reset } = useVariables();
  const { setFilter, clearFilters } = useFilters();
  const { setActiveTab, setModalOpen, refresh } = useUiState();
  const theme = useTheme();
  const entry = MANIFEST[node.type];

  if (!entry) {
    return <InvalidNode>{t('Unknown node type: %s', node.type)}</InvalidNode>;
  }

  const resolvedProps = resolveVars(node.props ?? {}, vars);

  const getBound = (prop: string): Primitive | undefined => {
    const ref = node.bind?.[prop];
    return ref ? vars[ref.slice(1)] : undefined;
  };

  const setBound = (prop: string, value: Primitive) => {
    const ref = node.bind?.[prop];
    if (!ref) {
      return;
    }
    const name = ref.slice(1);
    // Controls emit strings (an Input always does). Coerce to the variable's
    // declared type so a numeric parameter reaches the query as a number.
    const declared = decls[name]?.type;
    let next: Primitive = value;
    if (declared === 'number' && typeof value === 'string') {
      const parsed = Number(value);
      next = Number.isFinite(parsed) ? parsed : 0;
    } else if (declared === 'boolean' && typeof value === 'string') {
      next = value === 'true';
    }
    setVariable(name, next);
  };

  const fire = (event: string, value?: Primitive) => {
    runActions(node.on?.[event], {
      vars,
      setVariable,
      // Keyed by node+column so repeated clicks replace rather than accumulate.
      applyFilter: filter =>
        setFilter(`${node.id}:${filter.col}`, { filter: filter as CdlFilter }),
      crossFilter: filter =>
        setFilter(`${node.id}:${filter.col}`, { filter: filter as CdlFilter }),
      clearFilters: () => {
        clearFilters();
        reset();
      },
      navigateTab: (tabsId, tab) => setActiveTab(tabsId, tab),
      setModalOpen: (modalId, open) => setModalOpen(modalId, open),
      refresh: () => refresh(),
      eventValue: value,
    });
  };

  const Component = entry.component;
  const renderNode = (child: CdlNode) => (
    <NodeRenderer key={child.id} node={child} />
  );
  const children = node.children?.map(renderNode);

  return (
    <Component
      node={node}
      resolvedProps={resolvedProps}
      fire={fire}
      getBound={getBound}
      setBound={setBound}
      renderNode={renderNode}
      style={resolveStyle(
        node.style,
        theme as unknown as Record<string, unknown>,
      )}
    >
      {children}
    </Component>
  );
}

const ErrorList = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  color: ${({ theme }) => theme.colorError};
  font-family: ${({ theme }) => theme.fontFamilyCode};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

function ValidationErrors({ errors }: { errors: ValidationError[] }) {
  return (
    <ErrorList data-test="canvas-validation-errors">
      {errors.map(error => (
        <li key={`${error.path}:${error.message}`}>
          <strong>{error.path}</strong>: {error.message}
        </li>
      ))}
    </ErrorList>
  );
}

export interface CanvasRendererProps {
  definition: CanvasDefinition;
  queryRunner: QueryRunner;
  dataMaskSink?: VariableProviderProps['dataMaskSink'];
}

/**
 * Top-level entry: validate the CDL (hard-reject on failure), then render the
 * tree inside the query-runner and variable providers.
 */
export function CanvasRenderer({
  definition,
  queryRunner,
  dataMaskSink,
}: CanvasRendererProps) {
  const validation = useMemo(() => validateCanvas(definition), [definition]);

  if (!validation.valid) {
    return <ValidationErrors errors={validation.errors} />;
  }

  return (
    <QueryRunnerProvider runner={queryRunner}>
      <UiStateProvider>
        <FilterProvider>
          <VariableProvider
            variables={definition.variables}
            dataMaskSink={dataMaskSink}
          >
            <NodeRenderer node={definition.tree} />
          </VariableProvider>
        </FilterProvider>
      </UiStateProvider>
    </QueryRunnerProvider>
  );
}
