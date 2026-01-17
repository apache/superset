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

import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { renderHook } from '@testing-library/react';
import { StatusAnnouncerProvider, useAnnouncer } from './StatusAnnouncer';

// Helper component for testing announcer functions
const AnnouncerTestComponent = ({
  onMount,
}: {
  onMount?: (announcer: ReturnType<typeof useAnnouncer>) => void;
}) => {
  const announcer = useAnnouncer();
  if (onMount) {
    onMount(announcer);
  }
  return <div data-testid="test-component">Test</div>;
};

describe('StatusAnnouncerProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    test('renders children unchanged', () => {
      render(
        <StatusAnnouncerProvider>
          <div data-testid="child-content">Child Content</div>
        </StatusAnnouncerProvider>,
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    test('renders polite live region with role="status"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toBeInTheDocument();
      expect(politeRegion).toHaveAttribute('role', 'status');
    });

    test('renders assertive live region with role="alert"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toBeInTheDocument();
      expect(assertiveRegion).toHaveAttribute('role', 'alert');
    });

    test('live regions are visually hidden', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveStyleRule('position', 'absolute');
      expect(politeRegion).toHaveStyleRule('width', '1px');
      expect(politeRegion).toHaveStyleRule('height', '1px');
      expect(politeRegion).toHaveStyleRule('overflow', 'hidden');
    });

    test('live regions have correct IDs', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      expect(document.getElementById('a11y-status-announcer')).toBeInTheDocument();
      expect(document.getElementById('a11y-alert-announcer')).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes', () => {
    test('polite region has aria-live="polite"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    });

    test('assertive region has aria-live="assertive"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive');
    });

    test('both regions have aria-atomic="true"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const politeRegion = document.getElementById('a11y-status-announcer');
      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
      expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    test('polite region has id="a11y-status-announcer"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveAttribute('id', 'a11y-status-announcer');
    });

    test('assertive region has id="a11y-alert-announcer"', () => {
      render(
        <StatusAnnouncerProvider>
          <div>Content</div>
        </StatusAnnouncerProvider>,
      );
      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toHaveAttribute('id', 'a11y-alert-announcer');
    });
  });

  describe('Polite Announcements', () => {
    test('announcePolite updates polite region text', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announcePolite('Loading data...');
        jest.advanceTimersByTime(150);
      });

      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveTextContent('Loading data...');
    });

    test('polite announcement does not affect assertive region', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announcePolite('Status update');
        jest.advanceTimersByTime(150);
      });

      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toHaveTextContent('');
    });

    test('clears message before re-announcing same text', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      const politeRegion = document.getElementById('a11y-status-announcer');

      // First announcement
      act(() => {
        capturedAnnouncer!.announcePolite('Same message');
        jest.advanceTimersByTime(150);
      });
      expect(politeRegion).toHaveTextContent('Same message');

      // Second announcement with same text - should clear first
      act(() => {
        capturedAnnouncer!.announcePolite('Same message');
      });
      expect(politeRegion).toHaveTextContent('');

      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(politeRegion).toHaveTextContent('Same message');
    });

    test('handles empty string announcement', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announcePolite('');
        jest.advanceTimersByTime(150);
      });

      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveTextContent('');
    });

    test('handles long text announcements', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;
      const longText =
        'This is a very long announcement message that contains a lot of information about the current status of the application and should be read in its entirety by the screen reader.';

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announcePolite(longText);
        jest.advanceTimersByTime(150);
      });

      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveTextContent(longText);
    });

    test('handles special characters in message', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;
      const specialMessage = 'Status: 100% complete! <script>alert("test")</script>';

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announcePolite(specialMessage);
        jest.advanceTimersByTime(150);
      });

      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveTextContent(specialMessage);
    });
  });

  describe('Assertive Announcements', () => {
    test('announceAssertive updates assertive region text', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announceAssertive('Error: Connection failed');
        jest.advanceTimersByTime(150);
      });

      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toHaveTextContent('Error: Connection failed');
    });

    test('assertive announcement does not affect polite region', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announceAssertive('Error occurred');
        jest.advanceTimersByTime(150);
      });

      const politeRegion = document.getElementById('a11y-status-announcer');
      expect(politeRegion).toHaveTextContent('');
    });

    test('clears message before re-announcing same text', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      const assertiveRegion = document.getElementById('a11y-alert-announcer');

      act(() => {
        capturedAnnouncer!.announceAssertive('Error!');
        jest.advanceTimersByTime(150);
      });
      expect(assertiveRegion).toHaveTextContent('Error!');

      act(() => {
        capturedAnnouncer!.announceAssertive('Error!');
      });
      expect(assertiveRegion).toHaveTextContent('');

      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(assertiveRegion).toHaveTextContent('Error!');
    });

    test('handles empty string announcement', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      act(() => {
        capturedAnnouncer!.announceAssertive('');
        jest.advanceTimersByTime(150);
      });

      const assertiveRegion = document.getElementById('a11y-alert-announcer');
      expect(assertiveRegion).toHaveTextContent('');
    });
  });

  describe('Timing Behavior', () => {
    test('clears message with 100ms delay before re-announcing', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      const politeRegion = document.getElementById('a11y-status-announcer');

      act(() => {
        capturedAnnouncer!.announcePolite('First message');
      });

      // Message should be cleared immediately
      expect(politeRegion).toHaveTextContent('');

      // After 50ms, still cleared
      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(politeRegion).toHaveTextContent('');

      // After 100ms, message appears
      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(politeRegion).toHaveTextContent('First message');
    });

    test('handles rapid successive announcements', async () => {
      let capturedAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              capturedAnnouncer = announcer;
            }}
          />
        </StatusAnnouncerProvider>,
      );

      const politeRegion = document.getElementById('a11y-status-announcer');

      act(() => {
        capturedAnnouncer!.announcePolite('Message 1');
        capturedAnnouncer!.announcePolite('Message 2');
        capturedAnnouncer!.announcePolite('Message 3');
        jest.advanceTimersByTime(150);
      });

      // Last message should win
      expect(politeRegion).toHaveTextContent('Message 3');
    });
  });

  describe('Multiple Providers', () => {
    test('nested providers work independently', () => {
      render(
        <StatusAnnouncerProvider>
          <div data-testid="outer">
            <StatusAnnouncerProvider>
              <div data-testid="inner">Inner Content</div>
            </StatusAnnouncerProvider>
          </div>
        </StatusAnnouncerProvider>,
      );

      expect(screen.getByTestId('outer')).toBeInTheDocument();
      expect(screen.getByTestId('inner')).toBeInTheDocument();
    });

    test('each provider has own state', async () => {
      let outerAnnouncer: ReturnType<typeof useAnnouncer>;
      let innerAnnouncer: ReturnType<typeof useAnnouncer>;

      render(
        <StatusAnnouncerProvider>
          <AnnouncerTestComponent
            onMount={announcer => {
              outerAnnouncer = announcer;
            }}
          />
          <StatusAnnouncerProvider>
            <AnnouncerTestComponent
              onMount={announcer => {
                innerAnnouncer = announcer;
              }}
            />
          </StatusAnnouncerProvider>
        </StatusAnnouncerProvider>,
      );

      // Both announcers should be available
      expect(outerAnnouncer!.announcePolite).toBeDefined();
      expect(innerAnnouncer!.announcePolite).toBeDefined();
    });
  });
});

describe('useAnnouncer Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Inside Provider', () => {
    test('returns announcePolite function', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StatusAnnouncerProvider>{children}</StatusAnnouncerProvider>
      );

      const { result } = renderHook(() => useAnnouncer(), { wrapper });

      expect(result.current.announcePolite).toBeDefined();
      expect(typeof result.current.announcePolite).toBe('function');
    });

    test('returns announceAssertive function', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StatusAnnouncerProvider>{children}</StatusAnnouncerProvider>
      );

      const { result } = renderHook(() => useAnnouncer(), { wrapper });

      expect(result.current.announceAssertive).toBeDefined();
      expect(typeof result.current.announceAssertive).toBe('function');
    });

    test('functions are stable references (memoized)', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StatusAnnouncerProvider>{children}</StatusAnnouncerProvider>
      );

      const { result, rerender } = renderHook(() => useAnnouncer(), { wrapper });

      const firstPolite = result.current.announcePolite;
      const firstAssertive = result.current.announceAssertive;

      rerender();

      expect(result.current.announcePolite).toBe(firstPolite);
      expect(result.current.announceAssertive).toBe(firstAssertive);
    });
  });

  describe('Outside Provider', () => {
    test('returns no-op announcePolite function', () => {
      const { result } = renderHook(() => useAnnouncer());

      expect(result.current.announcePolite).toBeDefined();
      expect(typeof result.current.announcePolite).toBe('function');
    });

    test('returns no-op announceAssertive function', () => {
      const { result } = renderHook(() => useAnnouncer());

      expect(result.current.announceAssertive).toBeDefined();
      expect(typeof result.current.announceAssertive).toBe('function');
    });

    test('does not throw error', () => {
      const { result } = renderHook(() => useAnnouncer());

      expect(() => result.current.announcePolite('test')).not.toThrow();
      expect(() => result.current.announceAssertive('test')).not.toThrow();
    });

    test('no-op functions can be called safely', () => {
      const { result } = renderHook(() => useAnnouncer());

      // These should not throw
      result.current.announcePolite('test message');
      result.current.announceAssertive('test error');
    });
  });

  describe('Integration', () => {
    test('multiple components can use same announcer', () => {
      const ComponentA = () => {
        const { announcePolite } = useAnnouncer();
        return (
          <button type="button" onClick={() => announcePolite('From A')}>
            A
          </button>
        );
      };

      const ComponentB = () => {
        const { announcePolite } = useAnnouncer();
        return (
          <button type="button" onClick={() => announcePolite('From B')}>
            B
          </button>
        );
      };

      render(
        <StatusAnnouncerProvider>
          <ComponentA />
          <ComponentB />
        </StatusAnnouncerProvider>,
      );

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    test('announcements from different components work', async () => {
      const ComponentA = () => {
        const { announcePolite } = useAnnouncer();
        return (
          <button
            type="button"
            data-testid="button-a"
            onClick={() => announcePolite('From Component A')}
          >
            A
          </button>
        );
      };

      render(
        <StatusAnnouncerProvider>
          <ComponentA />
        </StatusAnnouncerProvider>,
      );

      const politeRegion = document.getElementById('a11y-status-announcer');
      const button = screen.getByTestId('button-a');

      act(() => {
        button.click();
        jest.advanceTimersByTime(150);
      });

      expect(politeRegion).toHaveTextContent('From Component A');
    });
  });
});
