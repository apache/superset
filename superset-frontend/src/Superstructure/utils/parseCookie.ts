type CookieMap = { [cookieId: string]: string };

export default function parseCookie(cookie = document.cookie): CookieMap {
  return Object.fromEntries(
    cookie
      .split('; ')
      .filter(x => x)
      .map(x => x.split('=')),
  );
}
