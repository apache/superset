import React from 'react';
import styled from '@emotion/styled';
import DocItem from '@theme-original/DocItem';

const EditPageLink = styled('a')`
  position: fixed;
  bottom: 20px;
  right: 20px;
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
