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
import { render, fireEvent } from 'spec/helpers/testing-library';
import ScrollToBottom from '.';

describe('ScrollToBottom', () => {
    it('renders without crashing', () => {
        render(<ScrollToBottom />);
    });

    it('is initially NOT visible', () => {
        const { getByRole } = render(<ScrollToBottom />);
        const button = getByRole('button');
        expect(button).not.toHaveClass('visible');
    });

    it('becomes visible after scrolling down but not reached bottom', () => {
        const { getByRole } = render(<ScrollToBottom />);
        const button = getByRole('button');

        // Mock document properties
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 500, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { value: 200, configurable: true });

        fireEvent.scroll(window);

        expect(button).toHaveClass('visible');
    });

    it('becomes hidden after reaching bottom', () => {
        const { getByRole } = render(<ScrollToBottom />);
        const button = getByRole('button');

        // Scrolled near bottom
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 500, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { value: 200, configurable: true });
        fireEvent.scroll(window);
        expect(button).toHaveClass('visible');

        // Reached bottom
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 800, configurable: true });
        fireEvent.scroll(window);
        expect(button).not.toHaveClass('visible');
    });

    it('scrolls to bottom when clicked', () => {
        const scrollToMock = jest.fn();
        window.scrollTo = scrollToMock;

        const { getByRole } = render(<ScrollToBottom />);
        const button = getByRole('button');

        // Make it visible first
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 500, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { value: 200, configurable: true });
        fireEvent.scroll(window);

        fireEvent.click(button);

        expect(scrollToMock).toHaveBeenCalledWith({
            top: 1000,
            behavior: 'smooth',
        });
    });
});
