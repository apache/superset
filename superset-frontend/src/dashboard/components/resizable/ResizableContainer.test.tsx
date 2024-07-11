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
import { render } from 'spec/helpers/testing-library';

import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';

interface ResizableContainerProps {
  id: string;
  children?: object;
  adjustableWidth?: boolean;
  adjustableHeight?: boolean;
  gutterWidth?: number;
  widthStep?: number;
  heightStep?: number;
  widthMultiple?: number;
  heightMultiple?: number;
  minWidthMultiple?: number;
  maxWidthMultiple?: number;
  minHeightMultiple?: number;
  maxHeightMultiple?: number;
  staticHeight?: number;
  staticHeightMultiple?: number;
  staticWidth?: number;
  staticWidthMultiple?: number;
  onResizeStop?: () => {};
  onResize?: () => {};
  onResizeStart?: () => {};
  editMode: boolean;
}

describe('ResizableContainer', () => {
  const props = { editMode: false, id: 'id' };

  const setup = (overrides?: ResizableContainerProps) => (
    <ResizableContainer {...props} {...overrides} />
  );

  it('should render a Resizable container', () => {
    const rendered = render(setup());
    const resizableContainer = rendered.container.querySelector(
      '.resizable-container',
    );
    expect(resizableContainer).toBeVisible();
  });
});
