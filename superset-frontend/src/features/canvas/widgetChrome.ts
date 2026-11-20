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
import { createContext } from 'react';

/**
 * Where a widget's own controls render, when a canvas provides somewhere.
 *
 * A widget's content sits in a box that scrolls and clips, and that box is its
 * own stacking context. Anything the widget renders inside it is therefore
 * subject to whatever the widget stacks internally -- an antd table's sticky
 * header sits at `columns * 2 + 3`, which buries a menu at the top right. The
 * canvas puts a node beside that box, as a sibling of the drag and resize
 * handles, and a widget portals its chrome into it. Chrome then shares the
 * handles' box and their stacking level, and no widget's internals can reach
 * it.
 *
 * Null where no canvas provides one, in which case chrome renders in place.
 */
export const CanvasWidgetChromeContext = createContext<HTMLElement | null>(
  null,
);
