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
import { SafeMarkdown, styled, t } from '@superset-ui/core';
import Handlebars from 'handlebars';
import moment from 'moment';
import { useMemo, useState } from 'react';
import { isPlainObject } from 'lodash';
import Helpers from 'just-handlebars-helpers';
import HandlebarsGroupBy from 'handlebars-group-by';
import asyncHelpers from 'handlebars-async-helpers-ts';

export interface HandlebarsViewerProps {
  templateSource: string;
  data: any;
}

// Wrap Handlebars with async helper support

const hb = asyncHelpers(Handlebars);
// Register synchronous helpers

Helpers.registerHelpers(hb);

// Example async helper setup
hb.registerHelper(
  'asyncGreet',
  async (name: string) =>
    new Promise(resolve => {
      setTimeout(() => resolve(`Hello, ${name}!`), 1000);
    }),
);

export const HandlebarsViewer = ({
  templateSource,
  data,
}: HandlebarsViewerProps) => {
  const [renderedTemplate, setRenderedTemplate] = useState('');
  const [error, setError] = useState('');
  const appContainer = document.getElementById('app');
  const { common } = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const htmlSanitization = common?.conf?.HTML_SANITIZATION ?? true;
  const htmlSchemaOverrides =
    common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};

  useMemo(() => {
    const renderTemplate = async (): Promise<void> => {
      try {
        const template = hb.compile(templateSource);
        const result = await template(data);
        setRenderedTemplate(result);
        setError('');
      } catch (error) {
        setRenderedTemplate('');
        setError(error.message);
      }
    };
    renderTemplate();
  }, [templateSource, data]);

  const Error = styled.pre`
    white-space: pre-wrap;
  `;

  if (error) {
    return <Error>{error}</Error>;
  }

  if (renderedTemplate) {
    return (
      <SafeMarkdown
        source={renderedTemplate}
        htmlSanitization={htmlSanitization}
        htmlSchemaOverrides={htmlSchemaOverrides}
      />
    );
  }
  return <p>{t('Loading...')}</p>;
};

//  usage: {{dateFormat my_date format="MMMM YYYY"}}
hb.registerHelper('dateFormat', function (context: any, block: any) {
  const f = block.hash.format || 'YYYY-MM-DD';
  return moment(context).format(f);
});

hb.registerHelper('parseJSON', (jsonString: string) => {
  if (jsonString === undefined)
    throw Error('Please call with an object. Example: `parseJSON myObj`');
  return JSON.parse(jsonString);
});

hb.registerHelper('inc', (value: string) => {
  if (value === undefined)
    throw Error('Please call with an object. Example: `inc @index`');
  return parseInt(value, 10) + 1;
});

// usage: {{  }}
hb.registerHelper('stringify', (obj: any, obj2: any) => {
  // calling without an argument
  if (obj2 === undefined)
    throw Error('Please call with an object. Example: `stringify myObj`');
  return isPlainObject(obj) ? JSON.stringify(obj) : String(obj);
});

hb.registerHelper('formatNumber', function (number: any, locale = 'en-US') {
  if (typeof number !== 'number') {
    return number;
  }
  return number.toLocaleString(locale);
});

HandlebarsGroupBy.register(hb);

// Example async function to fetch presigned URLs
async function fetchPresignedUrls0(imageLinks: string[]): Promise<string[]> {
  const response = await fetch('/api/v1/presigned_urls/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_links: imageLinks }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.presigned_urls;
  }
  console.error('Error fetching presigned URLs');
  return [];
}

// Register async helper
hb.registerHelper('getPresignedUrls', async (imageLinks: string[]) => {
  const urls = await fetchPresignedUrls0(imageLinks);
  const urls1 = JSON.parse(urls as unknown as string);
  const presignedUrls = urls1.map(
    (item: { presigned_url: string }) => item.presigned_url,
  );
  return presignedUrls;
});

hb.registerHelper('jsonToHtmlTable', (jsonData1: string, jsonData2: string) => {
  const assignmentData = JSON.parse(jsonData1);
  const reviewData = JSON.parse(jsonData2);
  const items = assignmentData.items || [];
  const errors = reviewData.diff || [];
  let html = '';

  let Total = assignmentData.total || '';
  const Date = assignmentData.txn ? assignmentData.txn.date || '' : '';
  const Hour = assignmentData.txn ? assignmentData.txn.hour || '' : '';
  const Minute = assignmentData.txn ? assignmentData.txn.minute || '' : '';
  const Suffix = assignmentData.txn ? assignmentData.txn.suffix || '' : '';
  let Channel = assignmentData.channel || '';

  if (items) {
    errors.forEach((error: any[][]) => {
      if (error[1][0] === 'total') {
        Total += `<br><span class="is_error">${error[2][0]}</span>`; // Add the incorrect original quantity
      } else if (error[1][0] === 'channel') {
        Channel += `<br><span class="is_error">${error[2][0]}</span>`; // Add the incorrect original quantity
      }
    });

    html +=
      '<h3>Summary</h3><table id="receipt_summary_table" class="pretty_table"><tbody>';
    html += `<tr><td>Total</td><td>${Total}</td></tr>
           <tr><td>Transaction Date</td><td>${Date}</td></tr>
           <tr><td>Transaction Time</td><td>${Hour}:${Minute}:${Suffix}</td></tr>
           <tr><td>Channel</td><td>${Channel}</td></tr>`;
    html += '</tbody></table>';
    // Check if items exist
    if (items.length === 0) {
      html += '<h3>Items</h3><br><p>No items found in the receipt data.</p>';
      return html;
    }

    if (items) {
      html +=
        '<h3>Items</h3><table id="receipt_item_table" class="pretty_table"><tbody>';
      items.forEach((item: any, index: any) => {
        let { qty } = item;
        let rin = item.upc || item.rin || '';
        let rsd = item.rsd || '';
        let { amount } = item;
        const errorMessages: string[] = [];

        // Check for quantity errors in the review data
        errors.forEach((error: any[][]) => {
          if (error[1][1] === index && error[1][2] === 'qty') {
            errorMessages.push('Incorrect Quantity');
            qty += `<br><span class="is_error">${error[2][0]}</span>`; // Add the incorrect original quantity
          } else if (
            error[1][1] === index &&
            (error[1][2] === 'rin' || error[1][2] === 'upc')
          ) {
            rin += `<br><span class="is_error">${error[2][0]}</span>`;
            errorMessages.push('Incorrect RIN');
          } else if (error[1][1] === index && error[1][2] === 'rsd') {
            rsd += `<br><span class="is_error">${error[2][0]}</span>`;
            errorMessages.push('Incorrect RSD');
          } else if (error[1][1] === index && error[1][2] === 'amount') {
            amount += `<br><span class="is_error">${error[2][0]}</span>`;
            errorMessages.push('Incorrect amount');
          }
        });

        const perItem = (
          parseFloat(item.amount) / parseInt(item.qty, 10)
        ).toFixed(2);

        html += `<tr id="item_${index}" class="">
                    <td>${item.type}</td>
                    <td>${qty}</td>
                    <td>${rin}</td>
                    <td>${rsd}</td>
                    <td>${amount}</td>
                    <td>${perItem}</td>
                    <td>${errorMessages.join(', ')}</td>
                </tr>`;
      });
      html += '</tbody></table>';
    }
  }
  return html;
});

// Handlebars.registerHelper('asyncGreet', async (name: string) =>
//     new Promise(resolve => {
//       setTimeout(() => {
//         resolve(`Hello, ${name}!`);
//       }, 5000); // Delay for 1 second
//     }),
// );

// Helpers.registerHelpers(Handlebars);
// asyncHelpers(Handlebars);
