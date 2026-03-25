import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar } from '../src/cookie-jar.js';

describe('CookieJar', () => {
  let jar;

  beforeEach(() => {
    jar = new CookieJar();
  });

  describe('setCookiesFromHeaders', () => {
    it('stores cookies from a single set-cookie header string', () => {
      jar.setCookiesFromHeaders('myapi', ['session=abc123; Path=/; HttpOnly']);

      const cookies = jar.getCookieHeader('myapi');
      assert.equal(cookies, 'session=abc123');
    });

    it('stores multiple cookies from an array of set-cookie headers', () => {
      jar.setCookiesFromHeaders('myapi', [
        'session=abc123; Path=/; HttpOnly',
        'token=xyz789; Path=/; Secure',
      ]);

      const cookies = jar.getCookieHeader('myapi');
      assert.ok(cookies.includes('session=abc123'));
      assert.ok(cookies.includes('token=xyz789'));
      assert.ok(cookies.includes('; '));
    });

    it('updates existing cookies with same name', () => {
      jar.setCookiesFromHeaders('myapi', ['session=old; Path=/']);
      jar.setCookiesFromHeaders('myapi', ['session=new; Path=/']);

      const cookies = jar.getCookieHeader('myapi');
      assert.equal(cookies, 'session=new');
    });

    it('keeps cookies separate per API', () => {
      jar.setCookiesFromHeaders('api1', ['session=aaa; Path=/']);
      jar.setCookiesFromHeaders('api2', ['session=bbb; Path=/']);

      assert.equal(jar.getCookieHeader('api1'), 'session=aaa');
      assert.equal(jar.getCookieHeader('api2'), 'session=bbb');
    });

    it('handles cookies with = in the value', () => {
      jar.setCookiesFromHeaders('myapi', ['token=abc=def=ghi; Path=/']);

      const cookies = jar.getCookieHeader('myapi');
      assert.equal(cookies, 'token=abc=def=ghi');
    });

    it('ignores empty set-cookie headers', () => {
      jar.setCookiesFromHeaders('myapi', []);

      const cookies = jar.getCookieHeader('myapi');
      assert.equal(cookies, '');
    });

    it('handles set-cookie with no attributes', () => {
      jar.setCookiesFromHeaders('myapi', ['simple=value']);

      assert.equal(jar.getCookieHeader('myapi'), 'simple=value');
    });
  });

  describe('getCookieHeader', () => {
    it('returns empty string for unknown API', () => {
      assert.equal(jar.getCookieHeader('unknown'), '');
    });

    it('joins multiple cookies with semicolon and space', () => {
      jar.setCookiesFromHeaders('myapi', [
        'a=1; Path=/',
        'b=2; Path=/',
        'c=3; Path=/',
      ]);

      assert.equal(jar.getCookieHeader('myapi'), 'a=1; b=2; c=3');
    });
  });

  describe('mergeWithExisting', () => {
    it('merges jar cookies with user-provided cookie header', () => {
      jar.setCookiesFromHeaders('myapi', ['session=abc; Path=/']);

      const merged = jar.mergeWithExisting('myapi', 'custom=xyz');
      assert.ok(merged.includes('session=abc'));
      assert.ok(merged.includes('custom=xyz'));
    });

    it('returns only jar cookies when no existing cookie', () => {
      jar.setCookiesFromHeaders('myapi', ['session=abc; Path=/']);

      assert.equal(jar.mergeWithExisting('myapi', undefined), 'session=abc');
      assert.equal(jar.mergeWithExisting('myapi', ''), 'session=abc');
    });

    it('returns only existing cookies when jar is empty', () => {
      assert.equal(jar.mergeWithExisting('myapi', 'custom=xyz'), 'custom=xyz');
    });

    it('user-provided cookies override jar cookies with same name', () => {
      jar.setCookiesFromHeaders('myapi', ['session=fromjar; Path=/']);

      const merged = jar.mergeWithExisting('myapi', 'session=fromuser');
      assert.equal(merged, 'session=fromuser');
    });
  });

  describe('expired cookies', () => {
    it('removes cookies with Max-Age=0', () => {
      jar.setCookiesFromHeaders('myapi', ['session=abc; Path=/']);
      jar.setCookiesFromHeaders('myapi', ['session=deleted; Max-Age=0']);

      assert.equal(jar.getCookieHeader('myapi'), '');
    });

    it('removes cookies with expires in the past', () => {
      jar.setCookiesFromHeaders('myapi', ['session=abc; Path=/']);
      jar.setCookiesFromHeaders('myapi', ['session=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);

      assert.equal(jar.getCookieHeader('myapi'), '');
    });
  });

  describe('clear', () => {
    it('clears cookies for a specific API', () => {
      jar.setCookiesFromHeaders('api1', ['session=aaa; Path=/']);
      jar.setCookiesFromHeaders('api2', ['session=bbb; Path=/']);

      jar.clear('api1');

      assert.equal(jar.getCookieHeader('api1'), '');
      assert.equal(jar.getCookieHeader('api2'), 'session=bbb');
    });

    it('clears all cookies when no API specified', () => {
      jar.setCookiesFromHeaders('api1', ['session=aaa; Path=/']);
      jar.setCookiesFromHeaders('api2', ['session=bbb; Path=/']);

      jar.clear();

      assert.equal(jar.getCookieHeader('api1'), '');
      assert.equal(jar.getCookieHeader('api2'), '');
    });
  });
});
