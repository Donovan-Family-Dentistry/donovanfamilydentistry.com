import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldLoadPracticeAnalytics } from '../src/utils/practice-analytics-policy.js';

test('practice analytics is disabled by default, including on canonical hosts', () => {
  assert.equal(shouldLoadPracticeAnalytics('donovanfamilydentistry.com', '/'), false);
  assert.equal(shouldLoadPracticeAnalytics('www.donovanfamilydentistry.com', '/services/'), false);
  assert.equal(shouldLoadPracticeAnalytics('preview.donovanfamilydentistry.com', '/'), false);
  assert.equal(shouldLoadPracticeAnalytics('candidate.pages.dev', '/'), false);
});

test('an explicit release flag remains limited to canonical production hosts', () => {
  assert.equal(shouldLoadPracticeAnalytics('donovanfamilydentistry.com', '/', true), true);
  assert.equal(shouldLoadPracticeAnalytics('www.donovanfamilydentistry.com', '/services/', true), true);
  assert.equal(shouldLoadPracticeAnalytics('preview.donovanfamilydentistry.com', '/', true), false);
  assert.equal(shouldLoadPracticeAnalytics('candidate.pages.dev', '/', true), false);
});

test('even with release flag, analytics excludes contact, forms, future designs, and review routes', () => {
  for (const pathname of ['/contact', '/contact/', '/forms', '/forms/', '/modern/', '/review/open-dental/']) {
    assert.equal(shouldLoadPracticeAnalytics('donovanfamilydentistry.com', pathname, true), false, pathname);
  }
});
