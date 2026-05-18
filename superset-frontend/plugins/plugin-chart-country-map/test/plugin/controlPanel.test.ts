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
import controlPanel from '../../src/plugin/controlPanel';

const allControlNames = (): string[] => {
  const names: string[] = [];
  controlPanel.controlPanelSections.forEach(section => {
    if (!section || !section.controlSetRows) return;
    section.controlSetRows.forEach(row => {
      row.forEach(cell => {
        if (typeof cell === 'string') {
          names.push(cell);
        } else if (cell && typeof cell === 'object' && 'name' in cell) {
          names.push((cell as { name: string }).name);
        }
      });
    });
  });
  return names;
};

const findControl = (name: string) => {
  for (const section of controlPanel.controlPanelSections) {
    if (!section || !section.controlSetRows) continue;
    for (const row of section.controlSetRows) {
      for (const cell of row) {
        if (
          cell &&
          typeof cell === 'object' &&
          'name' in cell &&
          (cell as { name: string }).name === name
        ) {
          return (cell as { config: any }).config;
        }
      }
    }
  }
  return null;
};

test('all required new controls are present', () => {
  const names = allControlNames();
  for (const required of [
    'worldview',
    'admin_level',
    'country',
    'region_set',
    'composite',
    'region_includes',
    'region_excludes',
    'show_flying_islands',
    'name_language',
  ]) {
    expect(names).toContain(required);
  }
});

test('show_flying_islands defaults to true', () => {
  const c = findControl('show_flying_islands');
  expect(c).not.toBeNull();
  expect(c.default).toBe(true);
});

test('worldview defaults to ukr (Superset editorial choice)', () => {
  const c = findControl('worldview');
  expect(c).not.toBeNull();
  expect(c.default).toBe('ukr');
});

test('name_language defaults to en', () => {
  const c = findControl('name_language');
  expect(c).not.toBeNull();
  expect(c.default).toBe('en');
});

test('admin_level offers exactly 0 / 1 / aggregated', () => {
  const c = findControl('admin_level');
  expect(c).not.toBeNull();
  const codes = c.choices.map((ch: [string, string]) => ch[0]);
  expect(codes).toEqual(['0', '1', 'aggregated']);
});

test('worldview includes ukr', () => {
  const c = findControl('worldview');
  const codes = c.choices.map((ch: [string, string]) => ch[0]);
  expect(codes).toContain('ukr');
});

test('worldview offers multiple NE-published editorials', () => {
  const c = findControl('worldview');
  const codes = c.choices.map((ch: [string, string]) => ch[0]);
  // Sanity-check a handful of high-impact ones — we don't pin the full
  // set so the build pipeline can add/remove worldviews without
  // tripping this test.
  expect(codes).toEqual(expect.arrayContaining(['default', 'ukr']));
  expect(codes.length).toBeGreaterThanOrEqual(2);
});

test('country selector visibility hides on Admin 0', () => {
  const c = findControl('country');
  expect(c).not.toBeNull();
  // Admin 0 (number 0 OR string "0") AND no composite → hidden
  expect(c.visibility({ controls: { admin_level: { value: 0 } } })).toBe(false);
  expect(c.visibility({ controls: { admin_level: { value: '0' } } })).toBe(
    false,
  );
  // Admin 1 → visible
  expect(c.visibility({ controls: { admin_level: { value: '1' } } })).toBe(
    true,
  );
  // Composite set → hidden regardless of admin_level
  expect(
    c.visibility({
      controls: {
        admin_level: { value: '1' },
        composite: { value: 'france_overseas' },
      },
    }),
  ).toBe(false);
});

test('country validator only fires when country is actually needed', () => {
  const c = findControl('country');
  // Admin 0 → no validator (the Data tab would otherwise show a
  // permanent "Country: cannot be empty" badge for a hidden control).
  expect(
    c.mapStateToProps({ controls: { admin_level: { value: '0' } } }).validators,
  ).toEqual([]);
  // Composite set → no validator
  expect(
    c.mapStateToProps({
      controls: {
        admin_level: { value: '1' },
        composite: { value: 'france_overseas' },
      },
    }).validators,
  ).toEqual([]);
  // Admin 1, no composite → validator present (single non-empty validator)
  expect(
    c.mapStateToProps({ controls: { admin_level: { value: '1' } } }).validators
      .length,
  ).toBe(1);
});

test('composite selector hides on Admin 0', () => {
  const c = findControl('composite');
  expect(c.visibility({ controls: { admin_level: { value: '0' } } })).toBe(
    false,
  );
  // At Admin 1 with the composite's anchor country (FRA) → visible
  expect(
    c.visibility({
      controls: {
        admin_level: { value: '1' },
        country: { value: 'FRA' },
      },
    }),
  ).toBe(true);
});

test('composite selector hides for countries with no scoped composite', () => {
  // The only composite shipped today is france_overseas, anchored on
  // FRA. Picking USA should leave nothing relevant to show.
  const c = findControl('composite');
  expect(
    c.visibility({
      controls: {
        admin_level: { value: '1' },
        country: { value: 'USA' },
      },
    }),
  ).toBe(false);
});

test('composite choices narrow to the selected country', () => {
  const c = findControl('composite');
  // FRA → france_overseas should be present
  const fra = c.mapStateToProps({
    controls: { country: { value: 'FRA' } },
  }).choices;
  expect(fra.map((ch: [string, string]) => ch[0])).toContain('france_overseas');
  // USA → no scoped composites today
  const usa = c.mapStateToProps({
    controls: { country: { value: 'USA' } },
  }).choices;
  expect(usa.map((ch: [string, string]) => ch[0])).not.toContain(
    'france_overseas',
  );
});

test('region_set selector only visible when admin_level === aggregated', () => {
  const c = findControl('region_set');
  expect(c).not.toBeNull();
  expect(
    c.visibility({ controls: { admin_level: { value: 'aggregated' } } }),
  ).toBe(true);
  expect(c.visibility({ controls: { admin_level: { value: '1' } } })).toBe(
    false,
  );
  expect(c.visibility({ controls: { admin_level: { value: '0' } } })).toBe(
    false,
  );
});

test('region_set choices key off the selected country (via mapStateToProps)', () => {
  const c = findControl('region_set');
  // SelectControl expects `choices` to be a literal array, so we feed
  // them through mapStateToProps which receives the current control
  // state on every render.
  const turChoices = c.mapStateToProps({
    controls: { country: { value: 'TUR' } },
  }).choices;
  expect(turChoices.length).toBeGreaterThanOrEqual(1);
  expect(turChoices[0][0]).toBe('nuts_1');

  const fraChoices = c.mapStateToProps({
    controls: { country: { value: 'FRA' } },
  }).choices;
  expect(fraChoices.length).toBeGreaterThanOrEqual(1);
  expect(fraChoices[0][0]).toBe('regions');

  // Country with no aggregated regions defined → empty
  const usaChoices = c.mapStateToProps({
    controls: { country: { value: 'USA' } },
  }).choices;
  expect(usaChoices).toEqual([]);
});
