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

import * as strings from '../../src/helpers/strings';

describe('strings', () => {
  describe('excerpt', () => {
    it('should extract all the characters from a string if it is less than 50 characters by default', () => {
      expect(strings.excerpt('just wow')).toEqual('just wow');
    });

    it('should extract 50 characters from a string if it has more than 50 characters by default', () => {
      expect(
        strings.excerpt(
          'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        ),
      ).toEqual('Lorem ipsum dolor sit amet, consectetur adipisicin...');
    });

    it('should extract provided number of characters from a string', () => {
      expect(strings.excerpt('Just wow', 4)).toEqual('Just...');
    });

    it('should extract all the characters from a string if the provided number of characters to be extracted is more than the number of characters', () => {
      expect(strings.excerpt('wow', 10)).toEqual('wow');
    });

    it('should return the string if the length parameter is not a number', () => {
      expect(strings.excerpt('just wow', 'random')).toEqual('just wow');
    });

    it('should return the parameter as it is if it is not a string', () => {
      expect(strings.excerpt(45)).toEqual(45);
    });
  });

  describe('sanitize', () => {
    it('should return a normal string as dash case', () => {
      expect(strings.sanitize('Just    wow')).toEqual('just-wow');
    });

    it('should return a string with special characters as dash case without special characters', () => {
      expect(strings.sanitize('*JuST *#wow#')).toEqual('just-wow');
    });
  });

  describe('newLineToBr', () => {
    it('should replace \\n with <br> tags', () => {
      expect(
        strings.newLineToBr('newLineToBr helper \n is very \n useful.'),
      ).toEqual('newLineToBr helper <br> is very <br> useful.');
    });
  });

  describe('capitalizeFirst', () => {
    it('should capitalize the first constter of a string', () => {
      expect(strings.capitalizeFirst('just wow')).toEqual('Just wow');
    });

    it('should return the param if it is not a string', () => {
      expect(strings.capitalizeFirst(1.1)).toEqual(1.1);
    });
  });

  describe('capitalizeEach', () => {
    it('should capitalize the first constter of a string', () => {
      expect(strings.capitalizeEach('just wow')).toEqual('Just Wow');
    });

    it('should return the param if it is not a string', () => {
      expect(strings.capitalizeEach(1)).toEqual(1);
    });
  });

  describe('lowercase', () => {
    it('should return lowercase value of a string param', () => {
      expect(strings.lowercase('Hello World!')).toEqual('hello world!');
    });
  });

  describe('uppercase', () => {
    it('should return uppercase value of a string param', () => {
      expect(strings.uppercase('hello world!')).toEqual('HELLO WORLD!');
    });
  });

  describe('first', () => {
    it('should return first element of an array(string)', () => {
      expect(strings.first(['David', 'Miller', 'Jones'])).toEqual('David');
    });

    it('should return empty string if the array is empty', () => {
      expect(strings.first([])).toEqual('');
    });
  });

  describe('last', () => {
    it('should return last element of an array(string)', () => {
      expect(strings.last(['David', 'Miller', 'Jones'])).toEqual('Jones');
    });

    it('should return empty string if the array is empty', () => {
      expect(strings.last([])).toEqual('');
    });
  });

  describe('concat', () => {
    it('should return concatenation of all param values(string)', () => {
      expect(strings.concat('hello', ' ', 'world', '!!!')).toEqual(
        'hello world!!!',
      );
    });

    it('should return concatenation of all param values(string and integer)', () => {
      expect(strings.concat('I have got', ' ', 4, ' ', 'apples.')).toEqual(
        'I have got 4 apples.',
      );
    });
  });

  describe('join', () => {
    it('should join the values of array of strings using the delimeter provided', () => {
      expect(strings.join(['Hands', 'legs', 'feet'], ' & ')).toEqual(
        'Hands & legs & feet',
      );
    });

    it('should return concatenation of elements of array using empty string if no delimeter provided', () => {
      expect(strings.join(['Hands', 'legs', 'feet'])).toEqual('Handslegsfeet');
    });

    it('should return false if the parameter is not an array', () => {
      expect(strings.join('hello')).toEqual(false);
    });
  });
});
