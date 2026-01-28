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
import type { LoadingProps, PositionOption, SizeOption } from './types';
import { Loading } from '.';

export default {
  title: 'Components/Loading',
  component: Loading,
  includeStories: [
    'LoadingGallery',
    'SizeAndOpacityShowcase',
    'ContextualExamples',
    'InteractiveLoading',
  ],
};

export const POSITIONS: PositionOption[] = ['normal', 'floating', 'inline'];
export const SIZES: SizeOption[] = ['s', 'm', 'l'];

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
  actions: { disable: true },
  controls: { disable: true },
};

export const SizeAndOpacityShowcase = () => (
  <div style={{ padding: '20px' }}>
    <h3>Size and Opacity Combinations</h3>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        alignItems: 'center',
      }}
    >
      <div>
        <strong>Size</strong>
      </div>
      <div>
        <strong>Normal</strong>
      </div>
      <div>
        <strong>Muted</strong>
      </div>
      <div>
        <strong>Usage Context</strong>
      </div>

      {SIZES.map(size => (
        <>
          <div key={`${size}-label`} style={{ fontWeight: 'bold' }}>
            {size.toUpperCase()} (
            {size === 's' ? '40px' : size === 'm' ? '70px' : '100px'})
          </div>
          <div
            key={`${size}-normal`}
            style={{
              textAlign: 'center',
              padding: '10px',
              border: '1px solid #eee',
            }}
          >
            <Loading size={size} position="normal" />
          </div>
          <div
            key={`${size}-muted`}
            style={{
              textAlign: 'center',
              padding: '10px',
              border: '1px solid #eee',
            }}
          >
            <Loading size={size} muted position="normal" />
          </div>
          <div
            key={`${size}-context`}
            style={{ fontSize: '12px', color: '#666' }}
          >
            {size === 's' && 'Filter bars, inline elements'}
            {size === 'm' && 'Explore pages, medium content'}
            {size === 'l' && 'Main loading, full pages'}
          </div>
        </>
      ))}
    </div>
  </div>
);

SizeAndOpacityShowcase.parameters = {
  actions: { disable: true },
  controls: { disable: true },
};

export const ContextualExamples = () => (
  <div style={{ padding: '20px' }}>
    <h3>Contextual Usage Examples</h3>

    <div style={{ marginBottom: '30px' }}>
      <h4>Filter Bar (size="s", muted)</h4>
      <div
        style={{
          height: '40px',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: '10px',
        }}
      >
        <span>Filter 1:</span>
        <Loading size="s" muted position="normal" />
        <span>Filter 2:</span>
        <Loading size="s" muted position="normal" />
        <span>Filter 3:</span>
        <Loading size="s" muted position="normal" />
      </div>
    </div>

    <div style={{ marginBottom: '30px' }}>
      <h4>Dashboard Chart Grid (size="s", muted)</h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          backgroundColor: '#f9f9f9',
          padding: '10px',
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              height: '150px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Loading size="s" muted position="normal" />
          </div>
        ))}
      </div>
    </div>

    <div style={{ marginBottom: '30px' }}>
      <h4>Explore Page (size="m")</h4>
      <div
        style={{
          height: '300px',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #ccc',
        }}
      >
        <Loading size="m" position="normal" />
      </div>
    </div>

    <div style={{ marginBottom: '30px' }}>
      <h4>Main Application Loading (size="l")</h4>
      <div
        style={{
          height: '400px',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #007bff',
          borderRadius: '8px',
        }}
      >
        <Loading size="l" position="normal" />
      </div>
    </div>
  </div>
);

ContextualExamples.parameters = {
  actions: { disable: true },
  controls: { disable: true },
};

export const InteractiveLoading = (args: LoadingProps) => <Loading {...args} />;

InteractiveLoading.args = {
  image: '',
  className: '',
  size: 'm',
  muted: false,
};

InteractiveLoading.argTypes = {
  position: {
    name: 'position',
    control: { type: 'select' },
    options: POSITIONS,
  },
  size: {
    name: 'size',
    control: { type: 'select' },
    options: SIZES,
  },
  muted: {
    name: 'muted',
    control: { type: 'boolean' },
  },
};
