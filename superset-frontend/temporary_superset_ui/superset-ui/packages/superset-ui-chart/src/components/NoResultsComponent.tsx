import React, { CSSProperties, useMemo } from 'react';

const MESSAGE_STYLES: CSSProperties = { maxWidth: 800 };
const TITLE_STYLES: CSSProperties = { fontSize: 20, fontWeight: 'bold', paddingBottom: 8 };
const BODY_STYLES: CSSProperties = { fontSize: 16 };

const generateContainerStyles: (
  height: number | string,
  width: number | string,
) => CSSProperties = (height: number | string, width: number | string) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  height,
  justifyContent: 'center',
  padding: 16,
  textAlign: 'center',
  width,
});

type Props = {
  className?: string;
  height: number | string;
  id?: string;
  width: number | string;
};

const NoResultsComponent = ({ className, height, id, width }: Props) => {
  const containerStyles = useMemo(() => generateContainerStyles(height, width), [height, width]);

  return (
    <div className={className} id={id} style={containerStyles}>
      <div style={MESSAGE_STYLES}>
        <div style={TITLE_STYLES}>No Results</div>
        <div style={BODY_STYLES}>
          No results were returned for this query. If you expected results to be returned, ensure
          any filters are configured properly and the datasource contains data for the selected time
          range.
        </div>
      </div>
    </div>
  );
};

export default NoResultsComponent;
