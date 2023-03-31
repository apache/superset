export const scBase = {
  display: 'inline-block',
  verticalAlign: 'middle',
  margin: '0 auto',
  borderRadius: '50%',
  backgroundColor: 'rgba(0, 0, 0, 0)'
}

export const regionalSC = {
  ...scBase,
  width: '35px',
  height: '35px',
  border: '4px solid red'
}

export const subRegionalSC = {
  ...scBase,
  width: '30px',
  height: '30px',
  border: '3px solid blue'
}

export const neighbourhoodSC = {
  ...scBase,
  width: '25px',
  height: '25px',
  border: '3px solid orange'
}

export const cityCentreSC = {
  ...neighbourhoodSC,
  border: '3px solid yellow'
}

export const themedSC = {
  ...neighbourhoodSC,
  border: '3px solid pink'
}

export const lfrSC = {
  ...neighbourhoodSC,
  border: '3px solid blue'
}

export const outletSC = {
  ...neighbourhoodSC,
  border: '3px solid brown'
}

export const marketSC = {
  ...neighbourhoodSC,
  border: '3px solid green'
}