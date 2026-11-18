/*
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

/**
 * @fileoverview The shape of an artifact's `manifest.json`, with its JSON
 * (snake_case) keys. Mirrors `superset_artifacts_sdk.manifest`, where the
 * host validates manifests on every write; the Python SDK's
 * `test_artifact_typescript_sync.py` checks that the two agree.
 */

import type { Capability } from './capabilities';

export const MANIFEST_VERSION = '1';
/** The runtime SDK that the code expects in its frame. */
export const SDK_VERSION = '1';
/** Where the manifest lives in an artifact's file tree. */
export const MANIFEST_FILE = 'manifest.json';

/** A Superset dataset, by id. */
export interface DatasetSource {
  kind: 'dataset';
  dataset_id: number;
}

/** A saved chart, by id; the binding reuses its query. */
export interface SavedChartSource {
  kind: 'chart';
  chart_id: number;
}

/** A semantic view, whose metrics are defined centrally. */
export interface SemanticViewSource {
  kind: 'semantic_view';
  semantic_view: string;
}

export type BindingSource =
  | DatasetSource
  | SavedChartSource
  | SemanticViewSource;

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time_range'
  | 'string_list';

/** A value the artifact may change when it asks for a binding's data again. */
export interface ParameterSpec {
  type: ParameterType;
  required?: boolean;
  default?: unknown;
  /** When set, the only values the parameter accepts. */
  allowed?: unknown[] | null;
}

/** Live data runs as the viewer at every view; a snapshot is captured once. */
export type BindingMode = 'live' | 'snapshot';

/**
 * A named binding to Superset data, which the host runs as the viewer.
 * Bindings shaped like SIP-231's `SemanticQuery` are an open question.
 */
export interface Binding {
  source: BindingSource;
  metrics?: string[];
  dimensions?: string[];
  filters?: Record<string, unknown>[];
  /** Keyed by parameter name. */
  parameters?: Record<string, ParameterSpec>;
  row_limit?: number | null;
  /** `live` by default. */
  mode?: BindingMode;
}

/** Cross-filters are the only kind of event an artifact emits. */
export type EventKind = 'cross_filter';

/** A cross-filter the artifact emits, on one dimension of one binding. */
export interface EventDecl {
  kind: EventKind;
  binding: string;
  dimension: string;
}

/** What the code is written for; the build decides how to bundle each. */
export type Runtime = 'html' | 'react';

export interface ArtifactManifest {
  artifact_version: typeof MANIFEST_VERSION;
  /** `1` by default. */
  sdk?: typeof SDK_VERSION;
  /** `html` by default. */
  runtime?: Runtime;
  /** A path in the artifact's tree; `index.html` by default. */
  entrypoint?: string;
  title?: string | null;
  /** Keyed by binding name. */
  bindings?: Record<string, Binding>;
  events?: EventDecl[];
  capabilities?: Capability[];
  /** npm package name to exact version, such as `{ "d3": "7.9.0" }`. */
  dependencies?: Record<string, string>;
  /** Opaque, by vendor name; grants nothing. */
  extensions?: Record<string, Record<string, unknown>>;
}
