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

import { useState } from 'react';
import { StatusAnnouncerProvider, useAnnouncer } from './StatusAnnouncer';

export default {
  title: 'Components/Accessibility/StatusAnnouncer',
  component: StatusAnnouncerProvider,
  parameters: {
    docs: {
      description: {
        component:
          'WCAG 4.1.3 Status Messages - ARIA live regions for screen reader announcements. ' +
          'Provides polite announcements for non-urgent updates and assertive announcements for urgent messages. ' +
          'Enable a screen reader (VoiceOver, NVDA, JAWS) to hear the announcements.',
      },
    },
  },
};

// Helper component for demos
const AnnouncerButtons = () => {
  const { announcePolite, announceAssertive } = useAnnouncer();
  const [lastAction, setLastAction] = useState<string>('');

  const handlePolite = (message: string) => {
    announcePolite(message);
    setLastAction(`Polite: "${message}"`);
  };

  const handleAssertive = (message: string) => {
    announceAssertive(message);
    setLastAction(`Assertive: "${message}"`);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Polite Announcements (non-urgent)</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => handlePolite('Loading data...')}>
            Loading
          </button>
          <button type="button" onClick={() => handlePolite('3 items selected')}>
            Selection
          </button>
          <button type="button" onClick={() => handlePolite('Changes saved successfully')}>
            Save Success
          </button>
          <button type="button" onClick={() => handlePolite('Filter applied: Last 7 days')}>
            Filter Applied
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Assertive Announcements (urgent)</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleAssertive('Error: Connection failed')}
            style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px' }}
          >
            Error
          </button>
          <button
            type="button"
            onClick={() => handleAssertive('Warning: Session expires in 1 minute')}
            style={{ background: '#ffc107', border: 'none', padding: '8px 16px' }}
          >
            Warning
          </button>
          <button
            type="button"
            onClick={() => handleAssertive('Critical: Database connection lost')}
            style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px' }}
          >
            Critical
          </button>
        </div>
      </div>

      {lastAction && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#e9ecef',
            borderRadius: 4,
            fontFamily: 'monospace',
          }}
        >
          Last announcement: {lastAction}
        </div>
      )}

      <p style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        Enable a screen reader to hear these announcements. Polite announcements wait for the
        current speech to finish, while assertive announcements interrupt immediately.
      </p>
    </div>
  );
};

// Interactive demo
export const InteractiveDemo = () => (
  <StatusAnnouncerProvider>
    <AnnouncerButtons />
  </StatusAnnouncerProvider>
);

InteractiveDemo.parameters = {
  docs: {
    description: {
      story:
        'Interactive demo showing both polite and assertive announcements. ' +
        'Enable a screen reader to hear the announcements when buttons are clicked.',
    },
  },
};

// Real-world usage example
const RealWorldComponent = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { announcePolite, announceAssertive } = useAnnouncer();

  const handleSave = async () => {
    setLoading(true);
    setStatus('idle');
    announcePolite('Saving changes...');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Randomly succeed or fail for demo
    if (Math.random() > 0.3) {
      setStatus('success');
      announcePolite('Changes saved successfully');
    } else {
      setStatus('error');
      announceAssertive('Error: Failed to save changes. Please try again.');
    }
    setLoading(false);
  };

  const handleLoad = async () => {
    setLoading(true);
    announcePolite('Loading dashboard data...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    announcePolite('Dashboard loaded. 5 charts, 3 filters available.');
    setLoading(false);
  };

  return (
    <div>
      <h3>Dashboard Editor</h3>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="button" onClick={handleSave} disabled={loading}>
          {loading ? 'Processing...' : 'Save Dashboard'}
        </button>
        <button type="button" onClick={handleLoad} disabled={loading}>
          {loading ? 'Processing...' : 'Load Dashboard'}
        </button>
      </div>

      {status === 'success' && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#d4edda',
            color: '#155724',
            borderRadius: 4,
          }}
        >
          Changes saved successfully!
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: 4,
          }}
        >
          Failed to save changes. Please try again.
        </div>
      )}

      <p style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        This example simulates real-world usage with loading states, success, and error scenarios.
        Screen reader users will hear status updates without visual feedback.
      </p>
    </div>
  );
};

export const RealWorldExample = () => (
  <StatusAnnouncerProvider>
    <RealWorldComponent />
  </StatusAnnouncerProvider>
);

RealWorldExample.parameters = {
  docs: {
    description: {
      story:
        'Real-world example showing how the announcer integrates with async operations. ' +
        'Demonstrates loading states, success messages, and error handling with appropriate announcement types.',
    },
  },
};

// Chart interaction example
const ChartInteractionComponent = () => {
  const { announcePolite } = useAnnouncer();
  const [selectedPoints, setSelectedPoints] = useState(0);

  const handleChartClick = () => {
    const newCount = selectedPoints + 1;
    setSelectedPoints(newCount);
    announcePolite(`${newCount} data point${newCount !== 1 ? 's' : ''} selected`);
  };

  const handleClearSelection = () => {
    setSelectedPoints(0);
    announcePolite('Selection cleared');
  };

  return (
    <div>
      <h3>Chart Interaction Demo</h3>

      <div
        onClick={handleChartClick}
        onKeyDown={e => e.key === 'Enter' && handleChartClick()}
        role="button"
        tabIndex={0}
        style={{
          width: 300,
          height: 200,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          marginTop: 16,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 'bold' }}>{selectedPoints}</div>
          <div>Click to select data points</div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClearSelection}
        style={{ marginTop: 16 }}
        disabled={selectedPoints === 0}
      >
        Clear Selection
      </button>

      <p style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        Click the chart area to simulate selecting data points. Screen reader users will hear
        selection count updates.
      </p>
    </div>
  );
};

export const ChartInteraction = () => (
  <StatusAnnouncerProvider>
    <ChartInteractionComponent />
  </StatusAnnouncerProvider>
);

ChartInteraction.parameters = {
  docs: {
    description: {
      story:
        'Demonstrates announcing chart interactions. ' +
        'Selection changes are announced to screen reader users.',
    },
  },
};

// Filter updates example
const FilterUpdatesComponent = () => {
  const { announcePolite } = useAnnouncer();
  const [filters, setFilters] = useState<string[]>([]);

  const availableFilters = ['Last 7 days', 'Last 30 days', 'This year', 'All time'];

  const toggleFilter = (filter: string) => {
    if (filters.includes(filter)) {
      const newFilters = filters.filter(f => f !== filter);
      setFilters(newFilters);
      announcePolite(`Filter removed: ${filter}. ${newFilters.length} filter${newFilters.length !== 1 ? 's' : ''} active.`);
    } else {
      const newFilters = [...filters, filter];
      setFilters(newFilters);
      announcePolite(`Filter applied: ${filter}. ${newFilters.length} filter${newFilters.length !== 1 ? 's' : ''} active.`);
    }
  };

  return (
    <div>
      <h3>Filter Panel</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {availableFilters.map(filter => (
          <button
            key={filter}
            type="button"
            onClick={() => toggleFilter(filter)}
            style={{
              padding: '8px 16px',
              background: filters.includes(filter) ? '#007bff' : '#e9ecef',
              color: filters.includes(filter) ? 'white' : 'black',
              border: 'none',
              borderRadius: 20,
              cursor: 'pointer',
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        Active filters: {filters.length > 0 ? filters.join(', ') : 'None'}
      </div>

      <p style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        Toggle filters to hear announcements about filter state changes.
      </p>
    </div>
  );
};

export const FilterUpdates = () => (
  <StatusAnnouncerProvider>
    <FilterUpdatesComponent />
  </StatusAnnouncerProvider>
);

FilterUpdates.parameters = {
  docs: {
    description: {
      story:
        'Shows how filter changes can be announced. ' +
        'Users are informed about active filters without needing to visually scan the UI.',
    },
  },
};

// Technical demo showing live regions
export const LiveRegionInspector = () => {
  const { announcePolite, announceAssertive } = useAnnouncer();
  const [politeText, setPoliteText] = useState('');
  const [assertiveText, setAssertiveText] = useState('');

  return (
    <StatusAnnouncerProvider>
      <div>
        <h3>Live Region Inspector</h3>
        <p style={{ marginBottom: 16 }}>
          This story shows the actual ARIA live regions. Use browser DevTools to inspect the
          visually hidden elements.
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="polite-input" style={{ display: 'block', marginBottom: 8 }}>
              Polite message:
            </label>
            <input
              id="polite-input"
              type="text"
              value={politeText}
              onChange={e => setPoliteText(e.target.value)}
              placeholder="Type a message..."
              style={{ width: '100%', padding: 8 }}
            />
            <button
              type="button"
              onClick={() => announcePolite(politeText)}
              style={{ marginTop: 8 }}
            >
              Announce Polite
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="assertive-input" style={{ display: 'block', marginBottom: 8 }}>
              Assertive message:
            </label>
            <input
              id="assertive-input"
              type="text"
              value={assertiveText}
              onChange={e => setAssertiveText(e.target.value)}
              placeholder="Type a message..."
              style={{ width: '100%', padding: 8 }}
            />
            <button
              type="button"
              onClick={() => announceAssertive(assertiveText)}
              style={{ marginTop: 8 }}
            >
              Announce Assertive
            </button>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 4 }}>
          <h4>ARIA Live Regions (inspect with DevTools)</h4>
          <pre style={{ fontSize: 12 }}>
            {`<div id="a11y-status-announcer" role="status" aria-live="polite" aria-atomic="true">
  <!-- Polite messages appear here -->
</div>

<div id="a11y-alert-announcer" role="alert" aria-live="assertive" aria-atomic="true">
  <!-- Assertive messages appear here -->
</div>`}
          </pre>
        </div>
      </div>
    </StatusAnnouncerProvider>
  );
};

LiveRegionInspector.parameters = {
  docs: {
    description: {
      story:
        'Technical demo showing the ARIA live regions used by the announcer. ' +
        'Use browser DevTools to inspect the visually hidden elements at the bottom of the DOM.',
    },
  },
};
