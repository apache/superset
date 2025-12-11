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
import Markdown from 'markdown-to-jsx';
import AtomicDesign from './atomic-design.png';

export default {
  title: 'Design System/Introduction',
};

export const DesignSystem = () => (
  <>
    <Markdown>
      {`
  # Superset Design System

  A design system is a complete set of standards intended to manage design at scale using reusable components and patterns.

  You can get an overview of Atomic Design concepts and a link to the full book on the topic here:

  <a href="https://bradfrost.com/blog/post/atomic-web-design/" target="_blank">
    Intro to Atomic Design
  </a>

  While the Superset Design System will use Atomic Design principles, we choose a different language to describe the elements.
      `}
    </Markdown>
    <table style={{ borderCollapse: 'collapse', margin: '16px 0' }}>
      <thead>
        <tr>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'left',
            }}
          >
            Atomic Design
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Atoms
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Molecules
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Organisms
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Templates
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Pages / Screens
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
            Superset Design
          </td>
          <td
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Foundations
          </td>
          <td
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Components
          </td>
          <td
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Patterns
          </td>
          <td
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Templates
          </td>
          <td
            style={{
              border: '1px solid #ddd',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            Features
          </td>
        </tr>
      </tbody>
    </table>
    <img
      src={AtomicDesign}
      alt="Atoms = Foundations, Molecules = Components, Organisms = Patterns, Templates = Templates, Pages / Screens = Features"
    />
  </>
);
