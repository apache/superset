/**
 * A11y Regression Test Suite
 *
 * These tests verify that critical accessibility patches survive upstream updates.
 * Each test reads the actual source files and checks for required a11y attributes,
 * ensuring that merges or rebases do not silently remove accessibility fixes.
 *
 * Run: npx jest a11y-regression.test
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('A11y Regression Tests', () => {
  describe('Phase 1: Level A Fixes', () => {
    test('ECharts Echart component uses SVGRenderer instead of CanvasRenderer', () => {
      const source = readSource(
        'plugins/plugin-chart-echarts/src/components/Echart.tsx',
      );
      expect(source).toContain('SVGRenderer');
      // Must NOT use CanvasRenderer in the echarts.use() call
      expect(source).not.toMatch(/use\(\[.*CanvasRenderer/);
    });

    test('BaseIcon supports aria-hidden and aria-label props', () => {
      const source = readSource(
        'packages/superset-ui-core/src/components/Icons/BaseIcon.tsx',
      );
      expect(source).toContain('aria-hidden');
      expect(source).toContain('aria-label');
    });

    test('Alert component uses role="alert" and aria-atomic', () => {
      const source = readSource(
        'packages/superset-core/src/ui/components/Alert/index.tsx',
      );
      expect(source).toContain('role="alert"');
      expect(source).toContain('aria-atomic');
      expect(source).toContain('aria-live');
    });

    test('LabeledErrorBoundInput supports aria-invalid and aria-describedby', () => {
      const source = readSource(
        'packages/superset-ui-core/src/components/Form/LabeledErrorBoundInput.tsx',
      );
      expect(source).toContain('aria-invalid');
      expect(source).toContain('aria-describedby');
    });
  });

  describe('Phase 2: AA Visual', () => {
    test('Global focus-visible styles are defined', () => {
      const globalStylesPath = path.join(
        ROOT,
        'packages/superset-core/src/ui/theme/GlobalStyles.tsx',
      );
      expect(fs.existsSync(globalStylesPath)).toBe(true);
      const source = fs.readFileSync(globalStylesPath, 'utf-8');
      expect(source).toContain('focus-visible');
    });

    test('ECharts uses SVGRenderer for text resize compliance (WCAG 1.4.4)', () => {
      // SVGRenderer produces DOM text nodes that scale with browser zoom,
      // unlike CanvasRenderer which renders to a bitmap
      const source = readSource(
        'plugins/plugin-chart-echarts/src/components/Echart.tsx',
      );
      expect(source).toMatch(/import\s*\{[^}]*SVGRenderer[^}]*\}/);
    });
  });

  describe('Phase 3: AA Interaction', () => {
    test('Form inputs use autoComplete attributes', () => {
      // At least one form should have proper autocomplete
      const sshTunnelForm = readSource(
        'src/features/databases/DatabaseModal/SSHTunnelForm.tsx',
      );
      expect(sshTunnelForm).toContain('autoComplete');
    });

    test('User form inputs have semantic autocomplete values', () => {
      const userListModal = readSource(
        'src/features/users/UserListModal.tsx',
      );
      // Should use semantic values like "given-name", not just "off"
      expect(userListModal).toMatch(/autoComplete=["'](?!off)/);
    });
  });

  describe('Phase 4: Infrastructure', () => {
    test('ECharts aria module is enabled with description generation', () => {
      const source = readSource(
        'plugins/plugin-chart-echarts/src/components/Echart.tsx',
      );
      // Verify the aria config object exists
      expect(source).toContain('aria');
      expect(source).toMatch(/aria[\s\S]*enabled[\s\S]*true/);
    });

    test('ECharts chart container has aria-label', () => {
      const source = readSource(
        'plugins/plugin-chart-echarts/src/components/Echart.tsx',
      );
      expect(source).toContain('aria-label');
    });

    test('Dropdown component has aria-label', () => {
      const source = readSource(
        'packages/superset-ui-core/src/components/Dropdown/index.tsx',
      );
      expect(source).toContain('aria-label');
    });

    test('TableView has aria-label support and role="region"', () => {
      const source = readSource(
        'packages/superset-ui-core/src/components/TableView/TableView.tsx',
      );
      expect(source).toContain('aria-label');
      expect(source).toContain('role="region"');
    });
  });
});
