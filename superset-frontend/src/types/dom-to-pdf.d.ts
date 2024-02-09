declare module 'dom-to-pdf' {
  interface Image {
    type: string;
    quality: number;
  }

  interface Options {
    margin: number;
    filename: string;
    image: Image;
    html2canvas: object;
    excludeClassNames?: string[];
  }

  const domToPdf = (
    elementToPrint: Element,
    options?: Options,
  ): Promise<any> => {};
  export default domToPdf;
}
