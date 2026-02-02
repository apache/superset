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

import SkipLink from './SkipLink';

export default {
  title: 'Components/Accessibility/SkipLink',
  component: SkipLink,
  parameters: {
    docs: {
      description: {
        component:
          'WCAG 2.4.1 Bypass Blocks - Skip link for keyboard navigation. ' +
          'Allows keyboard users to skip repetitive navigation and jump directly to main content. ' +
          'The link is visually hidden but becomes visible when focused via Tab key.',
      },
    },
  },
};

interface SkipLinkArgs {
  targetId: string;
  children: string;
}

// Interactive story with controls
export const InteractiveSkipLink = (args: SkipLinkArgs) => (
  <div>
    <SkipLink {...args} />
    <p style={{ marginTop: 20, color: '#666' }}>
      Press Tab to see the skip link appear at the top of the viewport.
    </p>
    <div id={args.targetId} style={{ marginTop: 40, padding: 20, background: '#f0f0f0' }}>
      <h2>Target Content</h2>
      <p>This is the target element that will receive focus when the skip link is activated.</p>
    </div>
  </div>
);

InteractiveSkipLink.args = {
  targetId: 'main-content',
  children: 'Skip to main content',
};

InteractiveSkipLink.argTypes = {
  targetId: {
    control: 'text',
    description: 'ID of the target element to focus when activated',
    table: {
      defaultValue: { summary: 'main-content' },
    },
  },
  children: {
    control: 'text',
    description: 'The text displayed in the skip link',
    table: {
      defaultValue: { summary: 'Skip to main content' },
    },
  },
};

// Full page demo showing realistic usage
export const FullPageDemo = () => (
  <div style={{ minHeight: '100vh' }}>
    <SkipLink targetId="main-content" />

    <header style={{ padding: 20, background: '#f8f8f8', borderBottom: '1px solid #ddd' }}>
      <nav>
        <a href="#" style={{ marginRight: 16 }}>
          Home
        </a>
        <a href="#" style={{ marginRight: 16 }}>
          Dashboards
        </a>
        <a href="#" style={{ marginRight: 16 }}>
          Charts
        </a>
        <a href="#" style={{ marginRight: 16 }}>
          SQL Lab
        </a>
        <a href="#">Settings</a>
      </nav>
    </header>

    <main
      id="main-content"
      tabIndex={-1}
      style={{ padding: 40, outline: 'none' }}
    >
      <h1>Main Content Area</h1>
      <p>
        Press <kbd>Tab</kbd> to see the skip link appear. Click it or press{' '}
        <kbd>Enter</kbd> to jump directly here, bypassing the navigation links above.
      </p>
      <p>
        This is essential for keyboard users who would otherwise need to tab through all
        navigation items on every page load.
      </p>
    </main>
  </div>
);

FullPageDemo.parameters = {
  docs: {
    description: {
      story:
        'Full page demonstration showing the skip link in a realistic layout. ' +
        'Press Tab to reveal the skip link, then activate it to jump to main content.',
    },
  },
};

// Custom text demo
export const CustomText = () => (
  <div>
    <SkipLink targetId="content">Direkt zum Inhalt springen</SkipLink>
    <p style={{ marginTop: 20, color: '#666' }}>
      Skip links can be internationalized with custom text.
    </p>
    <div id="content" style={{ marginTop: 40, padding: 20, background: '#e8f4f8' }}>
      <h2>Inhalt</h2>
      <p>Der Hauptinhalt der Seite.</p>
    </div>
  </div>
);

CustomText.parameters = {
  docs: {
    description: {
      story: 'Skip link with custom internationalized text (German example).',
    },
  },
};

// Multiple skip links
export const MultipleSkipLinks = () => (
  <div>
    <div style={{ position: 'relative' }}>
      <SkipLink targetId="nav">Skip to navigation</SkipLink>
    </div>
    <div style={{ position: 'relative' }}>
      <SkipLink targetId="main">Skip to main content</SkipLink>
    </div>
    <div style={{ position: 'relative' }}>
      <SkipLink targetId="footer">Skip to footer</SkipLink>
    </div>

    <p style={{ marginTop: 20, color: '#666' }}>
      Press Tab multiple times to cycle through all skip links.
    </p>

    <nav id="nav" tabIndex={-1} style={{ marginTop: 40, padding: 20, background: '#fff3cd' }}>
      <h2>Navigation</h2>
      <ul>
        <li>
          <a href="#">Link 1</a>
        </li>
        <li>
          <a href="#">Link 2</a>
        </li>
      </ul>
    </nav>

    <main id="main" tabIndex={-1} style={{ padding: 20, background: '#d4edda' }}>
      <h2>Main Content</h2>
      <p>The primary content of the page.</p>
    </main>

    <footer id="footer" tabIndex={-1} style={{ padding: 20, background: '#d1ecf1' }}>
      <h2>Footer</h2>
      <p>Footer information and links.</p>
    </footer>
  </div>
);

MultipleSkipLinks.parameters = {
  docs: {
    description: {
      story:
        'Multiple skip links for complex page layouts with distinct sections. ' +
        'Users can choose which section to jump to.',
    },
  },
};

// Accessibility testing story
export const AccessibilityTest = () => (
  <div>
    <SkipLink targetId="test-content" data-testid="skip-link">
      Skip to test content
    </SkipLink>

    <div style={{ marginTop: 20 }}>
      <h2>Accessibility Checklist</h2>
      <ul>
        <li>Link is hidden until focused (check by tabbing)</li>
        <li>Link has correct href attribute (#test-content)</li>
        <li>Link text provides clear description</li>
        <li>Focus indicator is visible (3px outline)</li>
        <li>Target element receives focus on activation</li>
        <li>Works with screen readers</li>
      </ul>
    </div>

    <div
      id="test-content"
      tabIndex={-1}
      style={{ marginTop: 40, padding: 20, background: '#f0f0f0' }}
    >
      <h2>Target Content</h2>
      <p>This element should receive focus when the skip link is activated.</p>
    </div>
  </div>
);

AccessibilityTest.parameters = {
  docs: {
    description: {
      story:
        'Test story for verifying accessibility requirements. ' +
        'Use browser dev tools and screen readers to verify compliance.',
    },
  },
};
