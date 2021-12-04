/*
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

import updateTextNode from '@superset-ui/core/src/dimension/svg/updateTextNode';
import createTextNode from '@superset-ui/core/src/dimension/svg/createTextNode';

describe('updateTextNode(node, options)', () => {
  it('handles empty options', () => {
    const node = updateTextNode(createTextNode());
    expect(node.getAttribute('class')).toEqual('');
    expect(node.style.font).toEqual('');
    expect(node.style.fontWeight).toEqual('');
    expect(node.style.fontSize).toEqual('');
    expect(node.style.fontStyle).toEqual('');
    expect(node.style.fontFamily).toEqual('');
    expect(node.style.letterSpacing).toEqual('');
    expect(node.textContent).toEqual('');
  });

  it('handles setting class', () => {
    const node = updateTextNode(createTextNode(), { className: 'abc' });
    expect(node.getAttribute('class')).toEqual('abc');
    expect(node.style.font).toEqual('');
    expect(node.style.fontWeight).toEqual('');
    expect(node.style.fontSize).toEqual('');
    expect(node.style.fontStyle).toEqual('');
    expect(node.style.fontFamily).toEqual('');
    expect(node.style.letterSpacing).toEqual('');
    expect(node.textContent).toEqual('');
  });

  it('handles setting text', () => {
    const node = updateTextNode(createTextNode(), { text: 'abc' });
    expect(node.getAttribute('class')).toEqual('');
    expect(node.style.font).toEqual('');
    expect(node.style.fontWeight).toEqual('');
    expect(node.style.fontSize).toEqual('');
    expect(node.style.fontStyle).toEqual('');
    expect(node.style.fontFamily).toEqual('');
    expect(node.style.letterSpacing).toEqual('');
    expect(node.textContent).toEqual('abc');
  });

  it('handles setting font', () => {
    const node = updateTextNode(createTextNode(), {
      style: {
        font: 'italic 30px Lobster 700',
      },
    });
    expect(node.getAttribute('class')).toEqual('');
    expect(node.style.fontWeight).toEqual('700');
    expect(node.style.fontSize).toEqual('30px');
    expect(node.style.fontStyle).toEqual('italic');
    expect(node.style.fontFamily).toEqual('Lobster');
    expect(node.style.letterSpacing).toEqual('');
    expect(node.textContent).toEqual('');
  });

  it('handles setting specific font style', () => {
    const node = updateTextNode(createTextNode(), {
      style: {
        fontFamily: 'Lobster',
        fontStyle: 'italic',
        fontWeight: '700',
        fontSize: '30px',
        letterSpacing: 1.1,
      },
    });
    expect(node.getAttribute('class')).toEqual('');
    expect(node.style.fontWeight).toEqual('700');
    expect(node.style.fontSize).toEqual('30px');
    expect(node.style.fontStyle).toEqual('italic');
    expect(node.style.fontFamily).toEqual('Lobster');
    expect(node.style.letterSpacing).toEqual('1.1');
    expect(node.textContent).toEqual('');
  });
});
