---
title: Design Guidelines
sidebar_position: 1
---

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

This is an area to host resources and documentation supporting the evolution and proper use of Superset design system elements. If content is to be added to this section or requires revisiting, a proposal should be submitted to the `dev@superset.apache.org` email list with either a text proposal or a link to a GitHub issue providing the markdown that will be added to this wiki. The Dev list will have the chance to review the proposal and arrive at lazy consensus. A committer may then copy/paste the markdown to this wiki, and make it public.

## Capitalization Guidelines

### Sentence case

Use sentence-case capitalization for everything in the UI (except these exceptions below).

Sentence case is predominantly lowercase. Capitalize only the initial character of the first word, and other words that require capitalization, like:

- **Proper nouns.** Objects in the product _are not_ considered proper nouns e.g. dashboards, charts, saved queries etc. Proprietary feature names eg. SQL Lab, Preset Manager _are_ considered proper nouns
- **Acronyms** (e.g. CSS, HTML)
- When referring to **UI labels that are themselves capitalized** from sentence case (e.g. page titles - Dashboards page, Charts page, Saved queries page, etc.)
- User input that is reflected in the UI. E.g. a user-named a dashboard tab

**Sentence case vs. Title case:**
- Title case: "A Dog Takes a Walk in Paris"
- Sentence case: "A dog takes a walk in Paris"

**Why sentence case?**

- It's generally accepted as the quickest to read
- It's the easiest form to distinguish between common and proper nouns

### How to refer to UI elements

When writing about a UI element, use the same capitalization as used in the UI.

For example, if an input field is labeled "Name" then you refer to this as the "Name input field". Similarly, if a button has the label "Save" in it, then it is correct to refer to the "Save button".

Where a product page is titled "Settings", you refer to this in writing as follows:
"Edit your personal information on the Settings page".

Often a product page will have the same title as the objects it contains. In this case, refer to the page as it appears in the UI, and the objects as common nouns:

- Upload a dashboard on the Dashboards page
- Go to Dashboards
- View dashboard
- View all dashboards
- Upload CSS templates on the CSS templates page
- Queries that you save will appear on the Saved queries page
- Create custom queries in SQL Lab then create dashboards

### Exceptions to sentence case

1. **Acronyms and abbreviations.**
   Examples: URL, CSV, XML, CSS, SQL, SSH, URI, NaN, CRON, CC, BCC

2. **Proper nouns and brand names.**
   Examples: Apache, Superset, AntD JavaScript, GeoJSON, Slack, Google Sheets, SQLAlchemy

3. **Technical terms derived from proper nouns.**
   Examples: Jinja, Gaussian, European (as in European time zone)

4. **Key names.** Capitalize button labels and UI elements as they appear in the product UI.
   Examples: Shift (as in the keyboard button), Enter key

5. **Named queries or specific labeled items.**
   Examples: Query A, Query B

6. **Database names.** Always capitalize names of database engines and connectors.
   Examples: Presto, Trino, Drill, Hive, Google Sheets

## Button Design Guidelines

### Overview

**Button variants:**

1. Primary
2. Secondary
3. Tertiary
4. Destructive

**Button styles:** Each button variant has three styles:

1. Text
2. Icon+text
3. Icon only

Primary buttons have a fourth style: dropdown.

**Usage:** Buttons communicate actions that users can take. Do not use for navigations, instead use links.

**Purpose:**

| Button Type | Description |
|------------|-------------|
| Primary | Main call to action, just 1 per page not including modals or main headers |
| Secondary | Secondary actions, always in conjunction with a primary |
| Tertiary | For less prominent actions; can be used in isolation or paired with a primary button |
| Destructive | For actions that could have destructive effects on the user's data |

### Format

#### Anatomy

Button text is centered using the Label style. Icons appear left of text when combined. If no text label exists, an icon must indicate the button's function.

#### Button size

- Default dimensions: 160px width × 32px height
- Text: 11px, Inter Medium, all caps
- Corners: 4px border radius
- Minimum padding: 8px around text
- Width can decrease if space is limited, but maintain minimum padding

#### Button groups

- Group related buttons to establish visual hierarchy
- Avoid overwhelming users with too many actions
- Limit calls to action; use tertiary/ghost buttons for layouts with 3+ actions
- Maintain consistent styles within groups when possible
- Space buttons 8px apart vertically or horizontally

#### Content guidelines

Button labels should be clear and predictable. Use the "\{verb\} + \{noun\}" format, except for common actions like "Done," "Close," "Cancel," "Add," or "Delete." This formula provides necessary context and aids translation, though compact UIs or localization needs may warrant exceptions.

## Error Message Design Guidelines

### Definition

Interface errors appear when the application can't do what the user wants, typically because:

- The app technically fails to complete the request
- The app can't understand the user input
- The user tries to combine operations that can't work together

In all cases, encountering errors increases user friction and frustration while trying to use the application. Providing an error experience that helps the user understand what happened and their next steps is key to building user confidence and increasing engagement.

### General best practices

**The best error experience is no error at all.** Before implementing error patterns, consider what you might do in the interface before the user would encounter an error to prevent it from happening at all. This might look like:

- Providing tooltips or microcopy to help users understand how to interact with the interface
- Disabling parts of the UI until desired conditions are met (e.g. disabling a Save button until mandatory fields in a form are completed)
- Correcting an error automatically (e.g. autocorrecting spelling errors)

**Only report errors users care about.** The only errors that should appear in the interface are errors that require user acknowledgement and action (even if that action is "try again later" or "contact support").

**Do not start the user in an error state.** If user inputs are required to display an initial interface (e.g. a chart in Explore), use empty states or field highlighting to drive users to the required action.

### Patterns

#### Pattern selection

Select one pattern per error (e.g. do not implement an inline and banner pattern for the same error).

| When the error... | Use... |
|------------------|--------|
| Is directly related to a UI control | Inline error |
| Is not directly related to a UI control | Banner error |

#### Inline

Inline errors are used when the source of the error is directly related to a UI control (text input, selector, etc.) such as the user not populating a required field or entering a number in a text field.

##### Anatomy

Use the `LabeledErrorBoundInput` component for this error pattern.

1. **Message** Provides direction on how to populate the input correctly.

##### Implementation details

- Where and when relevant, scroll the screen to the UI control with the error
- When multiple inline errors are present, scroll to the topmost error

#### Banner

Banner errors are used when the source of the error is not directly related to a UI control (text input, selector, etc.) such as a technical failure or a loading problem.

##### Anatomy

Use the `ErrorAlert` component for this error pattern.

1. **Headline** (optional): 1-2 word summary of the error
2. **Message**: What went wrong and what users should do next
3. **Expand option** (optional): "See more"/"See less"
4. **Details** (optional): Additional helpful context
5. **Modal** (optional): For spatial constraints using `ToastType.DANGER`

##### Implementation details

- Place the banner near the content area most relevant to the error
- For chart errors in Explore, use the chart area
- For modal errors, use the modal footer
- For app-wide errors, use the top of the screen

### Content guidelines

Effective error messages communicate:

1. What went wrong
2. What users should do next

Error messages should be:

- Clear and accurate, leaving no room for misinterpretation
- Short and concise
- Understandable to non-technical users
- Non-blaming and avoiding negative language

**Example:**

❌ "Cannot delete a datasource that has slices attached to it."

✅ "Please delete all charts using this dataset before deleting the dataset."
