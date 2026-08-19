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
import { SafeMarkdown } from '@superset-ui/core/components';
import { provider, useDashboardRevision } from '../store';

/**
 * The built-in `markdown` widget — registered like any other widget
 * (see `registerBuiltInWidgets`). Fills the box `WidgetView`'s
 * placement wrapper gives it (`width`/`height: 100%`) rather than resolving
 * its own grid placement.
 */
export default function MarkdownWidget({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const node = provider.getNode(nodeId);
  if (!node) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        // Surface, border, corners and inset all belong to the card
        // `WidgetView` draws around this widget and the name above
        // it, so that the name is inside the frame rather than over it.
        overflow: 'auto',
      }}
    >
      <SafeMarkdown source={String(node.props?.content ?? '')} />
    </div>
  );
}
