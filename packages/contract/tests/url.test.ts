import { describe, expect, it } from 'vitest';

import { isOpenable } from '../src/url.js';

/**
 * One case per row of the quickstart's address table, plus the two shapes that
 * make the rule a rule rather than a preference.
 *
 * This is the feature's whole safety story, so the tests that matter most are
 * the **refusals**. Two of them exist specifically because they are what a
 * plausible cheaper implementation lets through, and a suite that only tried
 * `file:` and `javascript:` would pass against both of those implementations.
 */

describe('isOpenable', () => {
  describe('opens ordinary web addresses', () => {
    it.each([
      ['https://example.atlassian.net/browse/PROJ-1234', 'the ordinary case'],
      ['http://localhost:8080/browse/PROJ-1', 'plain http, and a local one'],
      ['HTTPS://EXAMPLE.COM/PROJ-1', 'protocol case is normalised by the parser'],
      ['https://example.com/a b?q=1&r=2#frag', 'spaces, query and fragment'],
      ['https://例え.テスト/チケット', 'a non-ASCII host and path'],
    ])('%s — %s', (url) => {
      expect(isOpenable(url)).toBe(true);
    });
  });

  describe('refuses everything else', () => {
    it.each([
      ['file:///C:/Windows/System32/calc.exe', 'a local executable'],
      ['javascript:alert(1)', 'script as an address'],
      ['ms-msdt:/id', 'a registered application handler'],
      ['data:text/html,<script>alert(1)</script>', 'an inline document'],
      ['vbscript:msgbox(1)', 'the other script protocol'],
    ])('%s — %s', (url) => {
      expect(isOpenable(url)).toBe(false);
    });

    it('refuses httpx://example.com — the one a startsWith check passes', () => {
      // `startsWith('http')` is the first thing anybody writes here, and this is
      // the address that makes it wrong. Any protocol whose name begins with
      // those four letters is admitted by it and refused by parsing.
      expect(isOpenable('httpx://example.com')).toBe(false);
    });

    it('refuses javascript:void(0)//https://example.com — the one an includes check passes', () => {
      // The real protocol is `javascript:`; everything from `//` on is a comment
      // in the script that runs. Any `includes('https://')` test admits it, and
      // the string genuinely does contain `https://`.
      expect(isOpenable('javascript:void(0)//https://example.com')).toBe(false);
      // Stated as the fact that makes the case interesting, so that nobody
      // "simplifies" the rule and finds this test mysterious.
      expect('javascript:void(0)//https://example.com'.includes('https://')).toBe(true);
    });
  });

  describe('refuses rather than repairs', () => {
    it('does not promote a protocol-less address to https (FR-022)', () => {
      // Repairing this would be guessing what the sender meant, and the sender
      // is a program. It stays visible as text; it is simply not a control.
      expect(isOpenable('www.example.com')).toBe(false);
      expect(isOpenable('example.com/browse/PROJ-1')).toBe(false);
    });

    it('does not accept a relative or empty address', () => {
      expect(isOpenable('/browse/PROJ-1234')).toBe(false);
      expect(isOpenable('')).toBe(false);
      expect(isOpenable('   ')).toBe(false);
    });
  });

  describe('refuses anything that is not a string, without coercing it', () => {
    it.each([[null], [undefined], [42], [true], [['https://example.com']], [{}]])(
      '%s',
      (value) => {
        expect(isOpenable(value)).toBe(false);
      },
    );

    it('does not call toString on a hostile object', () => {
      // The value crosses a process boundary, so `String(x)` would run code the
      // sender chose. The type check has to come before any coercion.
      let called = false;
      const hostile = {
        toString(): string {
          called = true;
          return 'https://example.com';
        },
      };

      expect(isOpenable(hostile)).toBe(false);
      expect(called).toBe(false);
    });
  });
});
