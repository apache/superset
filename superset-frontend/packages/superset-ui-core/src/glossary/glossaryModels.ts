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

import { Glossary } from "./glossaryUtils";

// Encoding format prefix for glossary strings
export const GLOSSARY_ENCODING_PREFIX = '[GLOSSARY]|';

export class GlossaryTerm {
  /**
   * The topic under which the term is categorized.
   */
  private readonly topic: string;

  /**
   * The name of the term being defined.
   */
  private readonly title: string;

  /**
   * A short description of the term. Displayed on the frontend as a tooltip.
   */
  private readonly short: string;

  /**
   * An extended description of the term, shown alongside short on the documentation.
   */
  private readonly extended?: string;

  constructor(options: {
    topic: string;
    title: string;
    short: string;
    extended?: string;
  }) {
    this.topic = options.topic;
    this.title = options.title;
    this.short = options.short;
    this.extended = options.extended;
  }

  getTopic(): string {
    return this.topic;
  }

  getTitle(): string {
    return this.title;
  }

  /**
   * Returns a formatted display version of the title with underscores replaced by spaces.
   */
  getDisplayTitle(): string {
    return this.title.replace(/_/g, ' ');
  }

  /**
   * Returns the short description, optionally transformed by a provided translation function.
   */
  getShort(t?: (value: string) => string): string {
    if (!t) {
      return this.short;
    }
    return t(this.short);
  }

  getExtended(t?: (value: string) => string): string | undefined {
    if (!t) {
      return this.extended;
    }
    if (!this.extended) {
      return undefined;
    }
    return t(this.extended);
  }

  /**
   * Encodes the glossary term into a string format that can be resolved later.
   * Format: [GLOSSARY]|topic|title|description
   */
  encode(): string {
    return `${GLOSSARY_ENCODING_PREFIX}${this.topic}|${this.title}|${this.short}`;
  }
}

export class GlossaryTopic {
  private readonly name: string;

  private readonly terms: Map<string, GlossaryTerm>;

  constructor(name: string, terms: GlossaryTerm[]) {
    this.name = name;
    this.terms = new Map(terms.map(term => [term.getTitle(), term]));
  }

  getName(): string {
    return this.name;
  }

  getTerm(title: string): GlossaryTerm | undefined {
    return this.terms.get(title);
  }

  getAllTerms(): GlossaryTerm[] {
    return Array.from(this.terms.values());
  }
}

export class GlossaryMap {
  private readonly topics: Map<string, GlossaryTopic>;

  constructor(glossary: Glossary) {
    const topics = new Map<string, GlossaryTopic>();

    Object.entries(glossary).forEach(([topicName, termsByTitle]) => {
      const topicTerms = Object.values(termsByTitle);
      topics.set(topicName, new GlossaryTopic(topicName, topicTerms));
    });

    this.topics = topics;
  }

  getTopic(topicName: string): GlossaryTopic | undefined {
    return this.topics.get(topicName);
  }

  getAllTopics(): GlossaryTopic[] {
    return Array.from(this.topics.values());
  }
}
