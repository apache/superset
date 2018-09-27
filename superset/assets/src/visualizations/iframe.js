import Mustache from 'mustache';

export default function iframeWidget(slice) {
  const { selector, formData } = slice;
  const { url } = formData;
  const width = slice.width();
  const height = slice.height();
  const container = document.querySelector(selector);

  const completedUrl = Mustache.render(url, {
    width,
    height,
  });

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = height;
  iframe.setAttribute('src', completedUrl);
  container.appendChild(iframe);
}
