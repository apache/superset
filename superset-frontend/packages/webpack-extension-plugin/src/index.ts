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

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { Compiler, WebpackPluginInstance, sources, Compilation } from 'webpack';

// Contribution type definitions matching backend schema
interface CommandContribution {
  id: string;
  title: string;
  icon?: string;
  execute: string; // Module path to the execute function
}

interface ViewContribution {
  id: string;
  title: string;
  component: string; // Module path to the component
  location: string; // e.g., "dashboard.tabs", "explore.panels"
}

interface EditorContribution {
  id: string;
  name: string;
  component: string; // Module path to the component
  mimeTypes: string[];
}

interface MenuContribution {
  id: string;
  title: string;
  location: string; // e.g., "navbar.items", "context.menus"
  action: string; // Module path to the action
}

interface FrontendContributions {
  commands: CommandContribution[];
  views: Record<string, ViewContribution[]>; // Grouped by location
  editors: EditorContribution[];
  menus: Record<string, MenuContribution[]>; // Grouped by location
}

interface SupersetExtensionPluginOptions {
  outputPath?: string; // Where to write contributions.json
  include?: string[]; // File patterns to include
  exclude?: string[]; // File patterns to exclude
}

/**
 * Webpack plugin for auto-discovering Superset extension contributions.
 *
 * Analyzes TypeScript/JavaScript files during compilation to find calls to
 * define* functions from @apache-superset/core and outputs a contributions.json
 * file with the discovered contributions.
 */
export default class SupersetContributionPlugin implements WebpackPluginInstance {
  private options: SupersetExtensionPluginOptions;

  constructor(options: SupersetExtensionPluginOptions = {}) {
    this.options = {
      outputPath: 'contributions.json',
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: ['**/*.test.*', '**/node_modules/**'],
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap(
      'SupersetContributionPlugin',
      compilation => {
        compilation.hooks.processAssets.tap(
          {
            name: 'SupersetContributionPlugin',
            stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            try {
              const contributions = this.discoverContributions(
                compiler.context,
              );
              const contributionsJson = JSON.stringify(contributions, null, 2);

              // Add the contributions.json file to webpack's output
              const outputPath = this.options.outputPath!;
              compilation.emitAsset(
                outputPath,
                new sources.RawSource(contributionsJson),
              );

              console.log(
                `🔍 Discovered ${this.countContributions(contributions)} frontend contributions`,
              );
            } catch (error) {
              compilation.errors.push(
                new Error(`SupersetContributionPlugin: ${error}`),
              );
            }
          },
        );
      },
    );
  }

  private discoverContributions(rootPath: string): FrontendContributions {
    const contributions: FrontendContributions = {
      commands: [],
      views: {},
      editors: [],
      menus: {},
    };

    // Find all TypeScript/JavaScript files
    const files = this.findSourceFiles(rootPath);

    for (const filePath of files) {
      try {
        const fileContributions = this.analyzeFile(filePath);
        this.mergeContributions(contributions, fileContributions);
      } catch (error) {
        console.warn(`⚠️  Failed to analyze ${filePath}:`, error);
      }
    }

    return contributions;
  }

  private findSourceFiles(rootPath: string): string[] {
    const files: string[] = [];
    const { include, exclude } = this.options;

    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path
            .relative(rootPath, fullPath)
            .replace(/\\/g, '/'); // Normalize path separators

          if (entry.isDirectory()) {
            // Skip excluded directories and node_modules
            if (entry.name === 'node_modules') {
              continue;
            }
            const isExcluded = this.matchesPatterns(relativePath, exclude!);
            if (!isExcluded) {
              walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Only check files that might be relevant (have extensions we care about)
            const hasRelevantExtension = /\.(ts|tsx|js|jsx)$/.test(
              relativePath,
            );
            if (hasRelevantExtension) {
              const isIncluded = this.matchesPatterns(relativePath, include!);
              const isExcluded = this.matchesPatterns(relativePath, exclude!);

              if (isIncluded && !isExcluded) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    walkDir(rootPath);
    return files;
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Handle brace expansion like {ts,tsx,js,jsx}
      const expandedPatterns = this.expandBraces(pattern);
      return expandedPatterns.some(expandedPattern => {
        // Convert glob pattern to regex
        // Special handling for **/pattern which should match pattern directly
        let regex = expandedPattern
          // Replace glob patterns first
          .replace(/\*\*\/\*/g, '§DOUBLESTAR_SLASH_STAR§') // **/* becomes special pattern
          .replace(/\*\*/g, '§DOUBLESTAR§') // ** becomes another pattern
          .replace(/\*/g, '§STAR§') // * becomes yet another
          .replace(/\?/g, '§QUESTION§') // ? becomes final pattern
          // Then escape all regex special chars
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          // Then restore glob patterns as regex
          .replace(/§DOUBLESTAR_SLASH_STAR§/g, '(?:.*/)?[^/]*') // **/* matches zero+ dirs + filename
          .replace(/§DOUBLESTAR§/g, '(?:.*)?') // ** matches zero+ chars
          .replace(/§STAR§/g, '[^/]*') // * matches anything except /
          .replace(/§QUESTION§/g, '.'); // ? matches any single char

        const regexPattern = new RegExp(`^${regex}$`);
        const matches = regexPattern.test(filePath);

        return matches;
      });
    });
  }

  private expandBraces(pattern: string): string[] {
    const braceMatch = pattern.match(/^(.+)\{([^}]+)\}(.*)$/);
    if (!braceMatch) {
      return [pattern];
    }

    const [, prefix, options, suffix] = braceMatch;
    return options.split(',').map(option => prefix + option.trim() + suffix);
  }

  private analyzeFile(filePath: string): FrontendContributions {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
    );

    const contributions: FrontendContributions = {
      commands: [],
      views: {},
      editors: [],
      menus: {},
    };

    // Create a TypeScript program for type checking
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
      jsx: ts.JsxEmit.React,
    });

    const checker = program.getTypeChecker();

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        this.analyzeCallExpression(node, checker, contributions, filePath);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return contributions;
  }

  private analyzeCallExpression(
    call: ts.CallExpression,
    checker: ts.TypeChecker,
    contributions: FrontendContributions,
    filePath: string,
  ): void {
    if (!ts.isIdentifier(call.expression)) {
      return;
    }

    const functionName = call.expression.text;

    // Check if this is a define* function call
    if (
      !['defineCommand', 'defineView', 'defineEditor', 'defineMenu'].includes(
        functionName,
      )
    ) {
      return;
    }

    // For externals (like @apache-superset/core), validate by checking import statements
    const isValidPackage = this.isValidImportInFile(filePath, functionName);

    if (!isValidPackage) {
      console.warn(
        `⚠️  ${functionName} not imported from @apache-superset/core in ${filePath}`,
      );
      return;
    }

    // Extract the configuration object
    if (call.arguments.length === 0) {
      return;
    }

    const configArg = call.arguments[0];
    const config = this.extractObjectLiteral(configArg);

    if (!config) {
      console.warn(
        `⚠️  Could not extract config from ${functionName} call in ${filePath}`,
      );
      return;
    }

    // Process the contribution based on its type
    switch (functionName) {
      case 'defineCommand':
        this.processCommandContribution(config, contributions, filePath);
        break;
      case 'defineView':
        this.processViewContribution(config, contributions, filePath);
        break;
      case 'defineEditor':
        this.processEditorContribution(config, contributions, filePath);
        break;
      case 'defineMenu':
        this.processMenuContribution(config, contributions, filePath);
        break;
    }
  }

  private isValidImportInFile(filePath: string, functionName: string): boolean {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // Check for import statements that import our function from @apache-superset/core
      const importRegex = new RegExp(
        `import\\s+{[^}]*\\b${functionName}\\b[^}]*}\\s+from\\s+['"]@apache-superset/core['"]`,
      );

      const hasValidImport = importRegex.test(sourceCode);

      if (hasValidImport) {
        return true;
      }

      // Also check for default imports or namespace imports
      const defaultImportRegex =
        /import\s+\w+\s+from\s+['"]@apache-superset\/core['"]/;
      const namespaceImportRegex =
        /import\s+\*\s+as\s+\w+\s+from\s+['"]@apache-superset\/core['"]/;

      return (
        defaultImportRegex.test(sourceCode) ||
        namespaceImportRegex.test(sourceCode)
      );
    } catch (error) {
      return false;
    }
  }

  private extractObjectLiteral(node: ts.Node): Record<string, any> | null {
    if (!ts.isObjectLiteralExpression(node)) {
      return null;
    }

    const result: Record<string, any> = {};

    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const key = property.name.text;
        const value = this.extractValue(property.initializer);
        result[key] = value;
      }
    }

    return result;
  }

  private extractValue(node: ts.Node): any {
    if (ts.isStringLiteral(node)) {
      return node.text;
    } else if (ts.isNumericLiteral(node)) {
      return parseFloat(node.text);
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map(element => this.extractValue(element));
    } else if (ts.isObjectLiteralExpression(node)) {
      return this.extractObjectLiteral(node);
    }

    // For complex expressions, return a string representation
    return node.getText();
  }

  private processCommandContribution(
    config: Record<string, any>,
    contributions: FrontendContributions,
    filePath: string,
  ): void {
    if (!config.id || !config.title) {
      console.warn(
        `⚠️  Command contribution missing required fields in ${filePath}`,
      );
      return;
    }

    contributions.commands.push({
      id: config.id,
      title: config.title,
      icon: config.icon,
      execute: this.getModulePath(filePath),
    });
  }

  private processViewContribution(
    config: Record<string, any>,
    contributions: FrontendContributions,
    filePath: string,
  ): void {
    if (!config.id || !config.title || !config.location) {
      console.warn(
        `⚠️  View contribution missing required fields in ${filePath}`,
      );
      return;
    }

    const { location } = config;
    if (!contributions.views[location]) {
      contributions.views[location] = [];
    }

    contributions.views[location].push({
      id: config.id,
      title: config.title,
      component: this.getModulePath(filePath),
      location,
    });
  }

  private processEditorContribution(
    config: Record<string, any>,
    contributions: FrontendContributions,
    filePath: string,
  ): void {
    if (!config.id || !config.name || !config.mimeTypes) {
      console.warn(
        `⚠️  Editor contribution missing required fields in ${filePath}`,
      );
      return;
    }

    contributions.editors.push({
      id: config.id,
      name: config.name,
      component: this.getModulePath(filePath),
      mimeTypes: Array.isArray(config.mimeTypes)
        ? config.mimeTypes
        : [config.mimeTypes],
    });
  }

  private processMenuContribution(
    config: Record<string, any>,
    contributions: FrontendContributions,
    filePath: string,
  ): void {
    if (!config.id || !config.title || !config.location) {
      console.warn(
        `⚠️  Menu contribution missing required fields in ${filePath}`,
      );
      return;
    }

    const { location } = config;
    if (!contributions.menus[location]) {
      contributions.menus[location] = [];
    }

    contributions.menus[location].push({
      id: config.id,
      title: config.title,
      location,
      action: this.getModulePath(filePath),
    });
  }

  private getModulePath(filePath: string): string {
    // Convert absolute file path to a module path relative to src/
    const srcIndex = filePath.lastIndexOf('/src/');
    if (srcIndex !== -1) {
      return filePath.substring(srcIndex + 5).replace(/\.(ts|tsx|js|jsx)$/, '');
    }
    return filePath;
  }

  private mergeContributions(
    target: FrontendContributions,
    source: FrontendContributions,
  ): void {
    target.commands.push(...source.commands);
    target.editors.push(...source.editors);

    // Merge views by location
    for (const [location, views] of Object.entries(source.views)) {
      if (!target.views[location]) {
        target.views[location] = [];
      }
      target.views[location].push(...views);
    }

    // Merge menus by location
    for (const [location, menus] of Object.entries(source.menus)) {
      if (!target.menus[location]) {
        target.menus[location] = [];
      }
      target.menus[location].push(...menus);
    }
  }

  private countContributions(contributions: FrontendContributions): number {
    return (
      contributions.commands.length +
      contributions.editors.length +
      Object.values(contributions.views).flat().length +
      Object.values(contributions.menus).flat().length
    );
  }
}
