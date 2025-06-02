import { useEffect, useRef } from 'react';

const useClickedHeaderLabelTracker = () => {
  const clickedHeaderLabelRef = useRef(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const isHeaderLabel = (e.target as Element).closest(
        '.ag-header-cell-label',
      );
      clickedHeaderLabelRef.current = !!isHeaderLabel;

      setTimeout(() => {
        clickedHeaderLabelRef.current = false;
      }, 0);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return clickedHeaderLabelRef;
};

export default useClickedHeaderLabelTracker;
