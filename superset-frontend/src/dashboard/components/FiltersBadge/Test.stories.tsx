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
import React from 'react';
import { Popover } from 'src/common/components/index';
import { useTheme, css } from '@superset-ui/core';
import { Global } from '@emotion/core'

export default {
  title: 'PopoverTest',
  component: Popover,
  includeStories: ['ButtonGallery', 'InteractiveButton'],
};

export const ButtonGallery = () => {
    const theme = useTheme();

    const content = (
        <div>
            I'm dark!
            <Global
                styles={css`
                    .ant-popover-inner {
                    background-color: ${theme.colors.grayscale.dark2}cc;
                    }
                    .ant-popover > .ant-popover-content > .ant-popover-arrow{
                    border-top-color: ${theme.colors.grayscale.dark2}cc;
                    border-left-color: ${theme.colors.grayscale.dark2}cc;
                    }
                    .ant-popover *{
                    color: ${theme.colors.grayscale.light4};
                    }
                `}
            />
        </div>
    );

    const content2 = (
        <div>
            I'm light!
        </div>
    );

    return(
    <>
        <Popover
        content={content}
        placement="bottomRight"
        trigger="click"
        >
            Dark
        </Popover>
        
        <Popover
        content={content2}
        placement="bottomRight"
        trigger="click"
        >
            Light
        </Popover>
    </>
)};


ButtonGallery.argTypes = { onClick: { action: 'clicked' } };
