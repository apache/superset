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

export interface GridPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface CanvasNode {
  widget: string;
  layout: Record<string, unknown>;
  children?: string[];
}

export interface CanvasDefinition {
  version: number;
  root: {
    layout: { columns: number; gap: number; rowUnit: number };
    children: string[];
  };
  nodes: Record<string, CanvasNode>;
  interactions: { filters: Record<string, unknown> };
}

/** `GET /api/v1/canvas/<id>/definition` */
export interface CanvasDefinitionResult {
  version: number;
  revision: number;
  definition: CanvasDefinition;
  /** Filter node id -> node ids it drives. */
  filterScopes: Record<string, string[]>;
  /** Resolved grid placement of every node on a grid. */
  placements: Record<string, GridPlacement>;
  /** Node id -> widget type, for nodes whose widget resolves. */
  widgetTypes: Record<string, string>;
  /** Grid container node id -> its column count. */
  gridColumns: Record<string, number>;
}

/** A row of `GET /api/v1/canvas/`. */
export interface CanvasObject {
  id: number;
  uuid: string;
  title: string;
  description?: string | null;
  url: string;
  changed_on_delta_humanized?: string;
  changed_by?: { id: number; first_name: string; last_name: string } | null;
  editors?: { id: number; label: string; type: number }[];
}
