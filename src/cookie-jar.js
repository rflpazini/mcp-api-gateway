export class CookieJar {
  constructor() {
    this.jars = new Map();
  }

  setCookiesFromHeaders(apiName, setCookieHeaders) {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;

    if (!this.jars.has(apiName)) {
      this.jars.set(apiName, new Map());
    }

    const cookies = this.jars.get(apiName);

    for (const header of setCookieHeaders) {
      const parsed = parseCookieHeader(header);
      if (!parsed) continue;

      if (isExpired(header)) {
        cookies.delete(parsed.name);
      } else {
        cookies.set(parsed.name, parsed.value);
      }
    }
  }

  getCookieHeader(apiName) {
    const cookies = this.jars.get(apiName);
    if (!cookies || cookies.size === 0) return '';

    return [...cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  mergeWithExisting(apiName, existingCookie) {
    const jarCookies = this.jars.get(apiName);
    const jarMap = new Map(jarCookies || []);

    if (existingCookie) {
      const userCookies = existingCookie.split(';').map(s => s.trim()).filter(Boolean);
      for (const cookie of userCookies) {
        const eqIdx = cookie.indexOf('=');
        if (eqIdx > 0) {
          const name = cookie.substring(0, eqIdx).trim();
          const value = cookie.substring(eqIdx + 1).trim();
          jarMap.set(name, value);
        }
      }
    }

    if (jarMap.size === 0) return '';

    return [...jarMap.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  clear(apiName) {
    if (apiName) {
      this.jars.delete(apiName);
    } else {
      this.jars.clear();
    }
  }
}

function parseCookieHeader(header) {
  const cookiePart = header.split(';')[0].trim();
  const eqIdx = cookiePart.indexOf('=');
  if (eqIdx <= 0) return null;

  return {
    name: cookiePart.substring(0, eqIdx).trim(),
    value: cookiePart.substring(eqIdx + 1).trim(),
  };
}

function isExpired(header) {
  const lower = header.toLowerCase();

  const maxAgeMatch = lower.match(/max-age\s*=\s*(\d+)/);
  if (maxAgeMatch && parseInt(maxAgeMatch[1], 10) === 0) return true;

  const expiresMatch = header.match(/expires\s*=\s*([^;]+)/i);
  if (expiresMatch) {
    const expiresDate = Date.parse(expiresMatch[1].trim());
    if (!isNaN(expiresDate) && expiresDate < Date.now()) return true;
  }

  return false;
}
