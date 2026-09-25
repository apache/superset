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

/**
 * @fileoverview The widget contract, as this package's implementations see it.
 *
 * It is defined in `@apache-superset/core/widgets`: what a widget is, and what
 * it may ask of whoever renders it, is platform API that the builder, an
 * embedding host and any extension writing a widget all have to agree on. This
 * package implements it — the widgets, the bus, the data clients — and
 * re-exports it so its own modules, and a host application that installs only
 * this package, have one import for both halves.
 */
export type {
  DataBindingSpec,
  DataRow,
  HostFilter,
  InlineWidgetRef,
  QueryDataResult,
  SavedWidget,
  SavedWidgetRef,
  WidgetBus,
  WidgetComponent,
  WidgetDataClient,
  WidgetEvent,
  WidgetProps,
  WidgetRef,
} from '@apache-superset/core/widgets';
export type { Disposable } from '@apache-superset/core/common';
