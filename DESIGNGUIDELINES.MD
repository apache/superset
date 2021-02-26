<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
-->

# Design Guidelines

## Capitalization guidelines

## Sentence case

Use sentence-case capitalization for everything in the UI (except these \*\*).

Sentence case is predominantly lowercase. Capitalize only the initial character of the first word, and other words that require capitalization, like:

- **Proper nouns.** Objects in the product _are not_ considered proper nouns e.g. dashboards, charts, saved queries etc. Proprietary feature names eg. SQL Lab, Preset Manager _are_ considered proper nouns
- **Acronyms** (e.g. CSS, HTML)
- When referring to **UI labels that are themselves capitalized** from sentence case (e.g. page titles - Dashboards page, Charts page, Saved queries page, etc.)
- User input that is reflected in the UI. E.g. a user-named a dashboard tab

**Sentence case vs. Title case:**
Title case: "A Dog Takes a Walk in Paris"
Sentence case: "A dog takes a walk in Paris"

**Why sentence case?**

- It’s generally accepted as the quickest to read
- It’s the easiest form to distinguish between common and proper nouns

## How to refer to UI elements

When writing about a UI element, use the same capitalization as used in the UI.

For example, if an input field is labeled “Name” then you refer to this as the “Name input field”. Similarly, if a button has the label “Save” in it, then it is correct to refer to the “Save button”.

Where a product page is titled “Settings”, you refer to this in writing as follows:
“Edit your personal information on the Settings page”.

Often a product page will have the same title as the objects it contains. In this case, refer to the page as it appears in the UI, and the objects as common nouns:

- Upload a dashboard on the Dashboards page
- Go to Dashboards
- View dashboard
- View all dashboards
- Upload CSS templates on the CSS templates page
- Queries that you save will appear on the Saved queries page
- Create custom queries in SQL Lab then create dashboards

## \*\*Exceptions to sentence case:

- Input labels, buttons and UI tabs are all caps
- User input values (e.g. column names, SQL Lab tab names) should be in their original case