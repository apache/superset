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
import styled from '@emotion/styled';
import DocItem from '@theme-original/DocItem';

const EditPageLink = styled('a')`
  position: fixed;
  bottom: 40px;
  right: 10px;
  padding: 1rem;
  padding-left: 4rem;
  background-color: #444;
  border-radius: 10px;
  z-index: 9999;
  background-image: url('/img/github-dark.png');
  background-size: 2rem;
  background-position: 1rem center;
  background-repeat: no-repeat;
  transition: background-color 0.3s; /* Smooth transition for hover effect */
  bpx-shadow: 0 0 0 0 rgba(0,0,0,0); /* Smooth transition for hover effect */
  scale: .9;
  transition: all 0.3s;
  transform-origin: bottom right;

  &:hover {
    background-color: #333;
    box-shadow: 5px 5px 10px 0 rgba(0,0,0,0.3);
    scale: 1;
  }
`;

export default function DocItemWrapper(props) {
  return (
    <>
      <EditPageLink href={props.content.metadata.editUrl} target="_blank" rel="noopener noreferrer">
        Edit this page on GitHub
      </EditPageLink>
      <DocItem {...props} />
    </>
  );
}
