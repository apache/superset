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

import { Meta, StoryObj } from '@storybook/react-webpack5';
import { CanvasRenderer } from './CanvasRenderer';
import { salesCanvas, createMockRunner } from './fixtures/salesCanvas';

export default {
  title: 'Canvas/CanvasRenderer',
  component: CanvasRenderer,
} as Meta<typeof CanvasRenderer>;

type Story = StoryObj<typeof CanvasRenderer>;

/** Change the Region select (or hit Reset) and watch the bound chart re-query. */
export const InteractiveCanvas: Story = {
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <CanvasRenderer
        definition={salesCanvas}
        queryRunner={createMockRunner(300)}
      />
    </div>
  ),
};
