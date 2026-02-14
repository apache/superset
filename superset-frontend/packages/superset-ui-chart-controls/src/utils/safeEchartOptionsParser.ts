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

import { parse } from 'acorn';
import type { Node } from 'acorn';
import type { z } from 'zod';
import {
  customEChartOptionsSchema,
  titleSchema,
  legendSchema,
  gridSchema,
  axisSchema,
  tooltipSchema,
  dataZoomSchema,
  toolboxSchema,
  visualMapSchema,
  seriesSchema,
  graphicElementSchema,
  axisPointerSchema,
  textStyleSchema,
  type CustomEChartOptions,
} from './echartOptionsSchema';

// =============================================================================
// Custom Error Class
// =============================================================================

/**
 * Custom error class for EChart options parsing errors
 */
export class EChartOptionsParseError extends Error {
  public readonly errorType:
    | 'parse_error'
    | 'security_error'
    | 'validation_error';

  public readonly validationErrors: string[];

  public readonly location?: { line: number; column: number };

  constructor(
    message: string,
    errorType:
      | 'parse_error'
      | 'security_error'
      | 'validation_error' = 'parse_error',
    validationErrors: string[] = [],
    location?: { line: number; column: number },
  ) {
    super(message);
    this.name = 'EChartOptionsParseError';
    this.errorType = errorType;
    this.validationErrors = validationErrors;
    this.location = location;
  }
}

// =============================================================================
// Partial Validation Helper
// =============================================================================

/**
 * Maps top-level property names to their Zod schemas for partial validation
 */
const propertySchemas: Record<string, z.ZodTypeAny> = {
  title: titleSchema,
  legend: legendSchema,
  grid: gridSchema,
  xAxis: axisSchema,
  yAxis: axisSchema,
  tooltip: tooltipSchema,
  dataZoom: dataZoomSchema,
  toolbox: toolboxSchema,
  visualMap: visualMapSchema,
  series: seriesSchema,
  graphic: graphicElementSchema,
  axisPointer: axisPointerSchema,
  textStyle: textStyleSchema,
};

/**
 * Validates each property individually and returns only valid properties.
 * This allows partial validation where invalid properties are filtered out
 * while valid ones are kept. Throws an error if any validation issues are found.
 */
function validatePartial(data: Record<string, unknown>): CustomEChartOptions {
  const result: Record<string, unknown> = {};
  const validationErrors: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    const schema = propertySchemas[key];

    if (schema) {
      // For properties with known schemas, validate them
      if (Array.isArray(value)) {
        // Validate array items individually
        const validItems = value
          .map((item, index) => {
            const itemResult = schema.safeParse(item);
            if (itemResult.success) {
              return itemResult.data;
            }
            validationErrors.push(
              `Invalid array item in "${key}[${index}]": ${itemResult.error.issues.map(e => e.message).join(', ')}`,
            );
            return null;
          })
          .filter(item => item !== null);

        if (validItems.length > 0) {
          result[key] = validItems;
        }
      } else {
        // Validate single object
        const propResult = schema.safeParse(value);
        if (propResult.success) {
          result[key] = propResult.data;
        } else {
          validationErrors.push(
            `Invalid property "${key}": ${propResult.error.issues.map(e => e.message).join(', ')}`,
          );
        }
      }
    } else {
      // For primitive properties (animation, backgroundColor, etc.), validate with full schema
      const primitiveResult =
        customEChartOptionsSchema.shape[
          key as keyof typeof customEChartOptionsSchema.shape
        ]?.safeParse(value);

      if (primitiveResult?.success) {
        result[key] = primitiveResult.data;
      } else if (primitiveResult) {
        validationErrors.push(
          `Invalid property "${key}": ${primitiveResult.error?.issues.map(e => e.message).join(', ') ?? 'Invalid value'}`,
        );
      }
      // Unknown properties are silently ignored
    }
  }

  if (validationErrors.length > 0) {
    throw new EChartOptionsParseError(
      'EChart options validation failed',
      'validation_error',
      validationErrors,
    );
  }

  return result as CustomEChartOptions;
}

// =============================================================================
// AST Safety Validation
// =============================================================================

/**
 * Safe AST node types that are allowed in EChart options.
 * These represent static data structures without executable code.
 */
const SAFE_NODE_TYPES = new Set([
  'ObjectExpression',
  'ArrayExpression',
  'Literal',
  'Property',
  'Identifier',
  'UnaryExpression',
  'TemplateLiteral',
  'TemplateElement',
]);

const ALLOWED_UNARY_OPERATORS = new Set(['-', '+']);

const DANGEROUS_IDENTIFIERS = new Set([
  'eval',
  'Function',
  'constructor',
  'prototype',
  '__proto__',
  'window',
  'document',
  'globalThis',
  'process',
  'require',
  'import',
  'module',
  'exports',
]);

/**
 * Recursively validates that an AST node contains only safe constructs.
 * Throws an error if any unsafe patterns are detected.
 */
function validateNode(node: Node, path: string[] = []): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const nodeType = node.type;

  if (!SAFE_NODE_TYPES.has(nodeType)) {
    throw new Error(
      `Unsafe node type "${nodeType}" at path: ${path.join('.')}. ` +
        `Only static data structures are allowed.`,
    );
  }

  switch (nodeType) {
    case 'Identifier': {
      const identNode = node as Node & { name: string };
      if (DANGEROUS_IDENTIFIERS.has(identNode.name)) {
        throw new Error(
          `Dangerous identifier "${identNode.name}" detected at path: ${path.join('.')}`,
        );
      }
      break;
    }

    case 'UnaryExpression': {
      const unaryNode = node as Node & { operator: string; argument: Node };
      if (!ALLOWED_UNARY_OPERATORS.has(unaryNode.operator)) {
        throw new Error(
          `Unsafe unary operator "${unaryNode.operator}" at path: ${path.join('.')}`,
        );
      }
      validateNode(unaryNode.argument, [...path, 'argument']);
      break;
    }

    case 'ObjectExpression': {
      const objNode = node as Node & { properties: Node[] };
      objNode.properties.forEach((prop, index) => {
        validateNode(prop, [...path, `property[${index}]`]);
      });
      break;
    }

    case 'ArrayExpression': {
      const arrNode = node as Node & { elements: (Node | null)[] };
      arrNode.elements.forEach((elem, index) => {
        if (elem) {
          validateNode(elem, [...path, `element[${index}]`]);
        }
      });
      break;
    }

    case 'Property': {
      const propNode = node as Node & {
        key: Node;
        value: Node;
        computed: boolean;
      };
      if (propNode.computed) {
        throw new Error(
          `Computed properties are not allowed at path: ${path.join('.')}`,
        );
      }
      validateNode(propNode.key, [...path, 'key']);
      validateNode(propNode.value, [...path, 'value']);
      break;
    }

    case 'TemplateLiteral': {
      const templateNode = node as Node & {
        expressions: Node[];
        quasis: Node[];
      };
      if (templateNode.expressions.length > 0) {
        throw new Error(
          `Template literals with expressions are not allowed at path: ${path.join('.')}`,
        );
      }
      templateNode.quasis.forEach((quasi, index) => {
        validateNode(quasi, [...path, `quasi[${index}]`]);
      });
      break;
    }

    case 'Literal':
    case 'TemplateElement':
      break;

    default:
      throw new Error(`Unhandled node type: ${nodeType}`);
  }
}

/**
 * Converts a validated AST node to a JavaScript value.
 */
function astToValue(node: Node): unknown {
  switch (node.type) {
    case 'Literal': {
      const litNode = node as Node & { value: unknown };
      return litNode.value;
    }

    case 'UnaryExpression': {
      const unaryNode = node as Node & { operator: string; argument: Node };
      const argValue = astToValue(unaryNode.argument) as number;
      return unaryNode.operator === '-' ? -argValue : +argValue;
    }

    case 'Identifier': {
      const identNode = node as Node & { name: string };
      if (identNode.name === 'undefined') return undefined;
      if (identNode.name === 'null') return null;
      if (identNode.name === 'true') return true;
      if (identNode.name === 'false') return false;
      if (identNode.name === 'NaN') return NaN;
      if (identNode.name === 'Infinity') return Infinity;
      return identNode.name;
    }

    case 'ObjectExpression': {
      const objNode = node as Node & { properties: Node[] };
      const objResult: Record<string, unknown> = {};
      objNode.properties.forEach(prop => {
        const propNode = prop as Node & { key: Node; value: Node };
        const key = astToValue(propNode.key) as string;
        const value = astToValue(propNode.value);
        objResult[key] = value;
      });
      return objResult;
    }

    case 'ArrayExpression': {
      const arrNode = node as Node & { elements: (Node | null)[] };
      return arrNode.elements.map(elem => (elem ? astToValue(elem) : null));
    }

    case 'TemplateLiteral': {
      const templateNode = node as Node & {
        quasis: Array<Node & { value: { cooked: string } }>;
      };
      return templateNode.quasis.map(q => q.value.cooked).join('');
    }

    default:
      throw new Error(`Cannot convert node type: ${node.type}`);
  }
}

// =============================================================================
// Parse Result Types
// =============================================================================

interface ParseResult {
  success: boolean;
  data?: CustomEChartOptions;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Safely parses a JavaScript object literal string into an ECharts options object.
 *
 * This function performs two-stage validation:
 * 1. AST analysis for security (blocks functions, eval, etc.)
 * 2. Zod schema validation for type correctness
 *
 * @param input - A string containing a JavaScript object literal
 * @returns ParseResult with either the parsed/validated data or throws EChartOptionsParseError
 * @throws {EChartOptionsParseError} When parsing fails or validation errors occur
 *
 * @example
 * ```typescript
 * // Valid input
 * const result = parseEChartOptions(`{
 *   title: { text: 'My Chart', left: 'center' },
 *   grid: { top: 50, bottom: 50 }
 * }`);
 *
 * // Invalid input (title should be object, not string)
 * // Throws EChartOptionsParseError with validation errors
 * const result2 = parseEChartOptions(`{ title: 'text' }`);
 * ```
 */
export function parseEChartOptions(input: string | undefined): ParseResult {
  if (!input || typeof input !== 'string') {
    return { success: true, data: undefined };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { success: true, data: undefined };
  }

  // Step 1: Parse into AST
  const wrappedInput = `(${trimmed})`;
  let ast: Node & { body: Array<Node & { expression: Node }> };

  try {
    ast = parse(wrappedInput, {
      ecmaVersion: 2020,
      sourceType: 'script',
    }) as Node & { body: Array<Node & { expression: Node }> };
  } catch (error) {
    const err = error as Error & { loc?: { line: number; column: number } };
    throw new EChartOptionsParseError(err.message, 'parse_error', [], err.loc);
  }

  if (
    !ast.body ||
    ast.body.length !== 1 ||
    ast.body[0].type !== 'ExpressionStatement'
  ) {
    throw new EChartOptionsParseError(
      'Input must be a single object literal expression (e.g., { key: value })',
      'parse_error',
    );
  }

  const { expression } = ast.body[0];

  if (expression.type !== 'ObjectExpression') {
    throw new EChartOptionsParseError(
      `Expected an object literal, but got: ${expression.type}`,
      'parse_error',
    );
  }

  // Step 2: Validate AST for security (no functions, eval, etc.)
  try {
    validateNode(expression);
  } catch (error) {
    const err = error as Error;
    throw new EChartOptionsParseError(err.message, 'security_error');
  }

  // Step 3: Convert AST to JavaScript object
  const rawData = astToValue(expression);

  // Step 4: Validate against Zod schema with partial/lenient mode
  // This will throw EChartOptionsParseError if validation fails
  const validatedData = validatePartial(rawData as Record<string, unknown>);

  return { success: true, data: validatedData };
}

/**
 * Validates and parses EChart options.
 * Throws EChartOptionsParseError on failure for the caller to handle.
 *
 * @param input - A string containing a JavaScript object literal
 * @returns The parsed and validated EChart options, or undefined for empty input
 * @throws {EChartOptionsParseError} When parsing fails or validation errors occur
 */
export function safeParseEChartOptions(
  input: string | undefined,
): CustomEChartOptions | undefined {
  const result = parseEChartOptions(input);
  return result.data;
}

export default parseEChartOptions;
