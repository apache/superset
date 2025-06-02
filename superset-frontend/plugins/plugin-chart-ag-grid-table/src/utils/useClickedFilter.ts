import { useEffect, useRef } from 'react';

const useClickedFilterTracker = () => {
  const clickedFilterIconRef = useRef(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const isFilterIcon = (e.target as Element).closest('.ag-icon-filter');
      clickedFilterIconRef.current = !!isFilterIcon;

      setTimeout(() => {
        clickedFilterIconRef.current = false;
      }, 0);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return clickedFilterIconRef;
};

export default useClickedFilterTracker;
