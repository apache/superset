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

import { TooltipField, CustomTooltipConfig } from './CustomTooltipControl';

export interface TooltipData {
  [key: string]: unknown;
}

export interface ProcessedTooltipData {
  fields: {
    id: string;
    label: string;
    value: string;
    type: 'column' | 'metric';
  }[];
  raw: TooltipData;
}

/**
 * Simple template processor for Handlebars-like syntax
 * This is a basic implementation that can be enhanced with a full Handlebars library later
 */
export class TooltipTemplateService {
  private static instance: TooltipTemplateService;

  private templateCache: Map<string, (data: TooltipData) => string> = new Map();

  public static getInstance(): TooltipTemplateService {
    if (!TooltipTemplateService.instance) {
      TooltipTemplateService.instance = new TooltipTemplateService();
    }
    return TooltipTemplateService.instance;
  }

  /**
   * Process tooltip template with data
   */
  public processTemplate(
    template: string,
    config: CustomTooltipConfig,
    data: TooltipData,
  ): string {
    if (!config.enabled || !template) {
      return this.getDefaultTooltip(data);
    }

    try {
      const processedData = this.processData(config.fields, data);
      return this.renderTemplate(template, processedData);
    } catch (error) {
      console.error('Error processing tooltip template:', error);
      return this.getDefaultTooltip(data);
    }
  }

  /**
   * Process raw data into structured format for templates
   */
  private processData(
    fields: TooltipField[],
    data: TooltipData,
  ): ProcessedTooltipData {
    const processedFields = fields.map(field => ({
      id: field.id,
      label: field.label || field.name,
      value: this.formatValue(data[field.name]),
      type: field.type,
    }));

    return {
      fields: processedFields,
      raw: data,
    };
  }

  /**
   * Render template with data using simple Handlebars-like syntax
   */
  private renderTemplate(template: string, data: ProcessedTooltipData): string {
    let result = template;

    // Replace {{#each fields}} blocks
    result = result.replace(
      /{{#each fields}}([\s\S]*?){{\/each}}/g,
      (match, content) =>
        data.fields
          .map(field => {
            let fieldContent = content;
            fieldContent = fieldContent.replace(
              /{{this\.label}}/g,
              field.label,
            );
            fieldContent = fieldContent.replace(
              /{{this\.value}}/g,
              field.value,
            );
            fieldContent = fieldContent.replace(/{{this\.type}}/g, field.type);
            fieldContent = fieldContent.replace(/{{this\.id}}/g, field.id);
            return fieldContent;
          })
          .join(''),
    );

    // Replace individual field variables
    data.fields.forEach(field => {
      const fieldRegex = new RegExp(`{{${field.id}}}`, 'g');
      result = result.replace(fieldRegex, field.value);
    });

    // Replace {{#if}} blocks (basic implementation)
    result = result.replace(
      /{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g,
      (match, fieldName, ifContent, elseContent) => {
        const field = data.fields.find(f => f.id === fieldName);
        const hasValue = field?.value && field.value.trim() !== '';
        return hasValue ? ifContent : elseContent;
      },
    );

    // Replace {{#if}} blocks without else
    result = result.replace(
      /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
      (match, fieldName, content) => {
        const field = data.fields.find(f => f.id === fieldName);
        const hasValue = field?.value && field.value.trim() !== '';
        return hasValue ? content : '';
      },
    );

    return result;
  }

  /**
   * Format value for display
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number') {
      // Basic number formatting
      return value.toLocaleString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  }

  /**
   * Get default tooltip when template processing fails
   */
  private getDefaultTooltip(data: TooltipData): string {
    const entries = Object.entries(data)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        return `<div><strong>${formattedKey}:</strong> ${this.formatValue(value)}</div>`;
      });

    return `<div>${entries.join('')}</div>`;
  }

  /**
   * Validate template syntax
   */
  public validateTemplate(template: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for balanced brackets
    const openBrackets = (template.match(/{{/g) || []).length;
    const closeBrackets = (template.match(/}}/g) || []).length;

    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched template brackets');
    }

    // Check for balanced #each blocks
    const eachOpens = (template.match(/{{#each/g) || []).length;
    const eachCloses = (template.match(/{{\/each}}/g) || []).length;

    if (eachOpens !== eachCloses) {
      errors.push('Unmatched #each blocks');
    }

    // Check for balanced #if blocks
    const ifOpens = (template.match(/{{#if/g) || []).length;
    const ifCloses = (template.match(/{{\/if}}/g) || []).length;

    if (ifOpens !== ifCloses) {
      errors.push('Unmatched #if blocks');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get available template variables for a given field configuration
   */
  public getTemplateVariables(fields: TooltipField[]): string[] {
    const variables: string[] = [];

    // Add field-specific variables
    fields.forEach(field => {
      variables.push(field.id);
    });

    // Add template helpers
    variables.push('fields');
    variables.push('this.label');
    variables.push('this.value');
    variables.push('this.type');
    variables.push('this.id');

    return variables;
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
  }
}
