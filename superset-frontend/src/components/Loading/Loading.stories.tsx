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
import Loading, { Props, PositionOption } from './index';

export default {
  title: 'Loading',
  component: Loading,
  includeStories: ['LoadingGallery', 'InteractiveLoading'],
};

export const POSITIONS: PositionOption[] = ['normal', 'floating', 'inline'];

export const LoadingGallery = () => (
  <>
    {POSITIONS.map(position => (
      <div
        key={position}
        style={{
          marginBottom: 60,
          borderBottom: '1px solid #000',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <h4>{position}</h4>
        <Loading position={position} />
      </div>
    ))}
  </>
);

LoadingGallery.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
  },
};

export const InteractiveLoading = (args: Props) => <Loading {...args} />;

InteractiveLoading.args = {
  image: '',
  className: '',
};

InteractiveLoading.argTypes = {
  position: {
    name: 'position',
    control: { type: 'select' },
    options: POSITIONS,
  },
};
