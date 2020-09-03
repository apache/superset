import React from 'react';
import { useMenus } from 'docz';
import { getPreviousAndNextUrls } from '../utils';

const nextButtons = () => {
  const menus = useMenus();
  const [prevUrl, nextUrl] = getPreviousAndNextUrls(menus);
  return (
    <>
      {prevUrl && (
        <a href={prevUrl} className="ant-btn">
          Prev
        </a>
      )}
      {nextUrl && (
        <a href={nextUrl} className="ant-btn">
          Next
        </a>
      )}
    </>
  );
};

export default nextButtons;
