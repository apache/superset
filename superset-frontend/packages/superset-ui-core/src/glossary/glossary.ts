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

function t(message: string): string {
  return message;
}

export const GLOSSARY_BASE_URL = 'http://localhost:3000/docs'; // TODO: change to the actual URL

export interface GlossaryTerm {
  /**
   * The topic under which the term is categorized.
   */
  topic: string;
  /**
   * The name of the term being defined.
   */
  title: string;
  /**
   * A short description of the term. Displayed on the frontend as a tooltip.
   */
  short: string;
  /**
   * An extended description of the term, shown alongside short on the documentation.
   */
  extended?: string;
}

export class GlossaryTopic {
  private readonly name: string;

  private readonly terms: Map<string, GlossaryTerm>;

  constructor(name: string, terms: GlossaryTerm[]) {
    this.name = name;
    this.terms = new Map(terms.map(term => [term.title, term]));
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

export class Glossary {
  private readonly topics: Map<string, GlossaryTopic>;

  constructor(terms: GlossaryTerm[]) {
    const topics = new Map<string, GlossaryTopic>();

    const grouped = terms.reduce<Map<string, GlossaryTerm[]>>((acc, term) => {
      const existing = acc.get(term.topic) ?? [];
      existing.push(term);
      acc.set(term.topic, existing);
      return acc;
    }, new Map<string, GlossaryTerm[]>());

    grouped.forEach((topicTerms, topicName) => {
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

const glossary_terms: GlossaryTerm[] = [
  {
    topic: 'Query',
    title: 'Dimension',
    short: t(
      'Dimensions contain qualitative values such as names, dates, or geographical data. Use dimensions to categorize, segment, and reveal the details in your data. Dimensions affect the level of detail in the view.',
    ),
  },
  {
    topic: 'Query',
    title: 'Metric',
    short: t(
      'Select one or many metrics to display. You can use an aggregation function on a column or write custom SQL to create a metric.',
    ),
  },
];

export const getGlossaryUrl = (term: GlossaryTerm): string =>
  `${GLOSSARY_BASE_URL}/glossary#${encodeURIComponent(term.topic + "__" +term.title)}`;

const glossary = new Glossary(glossary_terms);

export default glossary;
