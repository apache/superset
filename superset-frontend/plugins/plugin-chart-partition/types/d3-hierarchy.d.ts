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

// d3-hierarchy ships no type declarations and there is no @types package
// for it in this workspace. src/Partition.ts sidesteps this with
// @ts-nocheck, but the regression test in test/Partition.test.ts imports
// `hierarchy` directly and relies on PartitionNode's `extends
// HierarchyNode<PartitionDataNode>`, so both need this module to resolve
// to real types. Only the members actually used by this plugin are
// declared; `this`-typed members mirror the upstream API so that
// PartitionNode (and any other interface extending HierarchyNode) narrows
// correctly through them.
declare module 'd3-hierarchy' {
  export interface HierarchyNode<Datum> {
    readonly data: Datum;
    readonly depth: number;
    readonly height: number;
    readonly value?: number;
    parent: this | null;
    children?: this[];
    sum(value: (d: Datum) => number): this;
    sort(compare: (a: this, b: this) => number): this;
    each(callback: (node: this) => void): this;
    eachAfter(callback: (node: this) => void): this;
    eachBefore(callback: (node: this) => void): this;
  }

  export function hierarchy<Datum>(
    data: Datum,
    children?: (d: Datum) => Iterable<Datum> | null | undefined,
  ): HierarchyNode<Datum>;
}
