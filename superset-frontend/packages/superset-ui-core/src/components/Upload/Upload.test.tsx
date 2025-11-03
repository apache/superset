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
import { render, screen, fireEvent, waitFor } from '@superset-ui/core/spec';
import { Button, Upload } from '..';

describe('Upload Component', () => {
  it('renders upload button and triggers file upload', async () => {
    const handleChange = jest.fn();

    render(
      <Upload onChange={handleChange}>
        <Button>Click to Upload</Button>
      </Upload>,
    );

    const btn = screen.getByRole('button', { name: /click to upload/i });
    expect(btn).toBeInTheDocument();

    const fileInput = btn.closest('span')?.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['dummy content'], 'example.png', {
      type: 'image/png',
    });
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });
});
