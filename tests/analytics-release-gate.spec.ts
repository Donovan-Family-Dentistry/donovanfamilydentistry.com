import { test, expect } from '@playwright/test';

const TRACKER_URL = /googletagmanager\.com|google-analytics\.com|clarity\.ms/i;
const TRACKER_SCRIPTS = 'script[src*="googletagmanager.com"], script[src*="google-analytics.com"], script[src*="clarity.ms"]';
const TRACKER_COOKIES = /^_(ga(?:_|$)|gid$|gat(?:_|$)|gac(?:_|$)|clck$|clsk$)|^(CLID|MUID|ANONCHK|MR|SM)$/i;
const CANONICAL_HOSTS = ['donovanfamilydentistry.com', 'www.donovanfamilydentistry.com'];
const PUBLIC_PATHS = ['/', '/services/', '/contact/', '/forms/', '/website-use/'];

test('default build sends no analytics requests from canonical-host pages', async ({ page }, testInfo) => {
  const localOrigin = testInfo.project.use.baseURL;
  if (typeof localOrigin !== 'string') throw new Error('Playwright baseURL is required for the local-only canonical-host test.');

  const trackingRequests: string[] = [];
  page.on('request', (request) => {
    if (TRACKER_URL.test(request.url())) trackingRequests.push(request.url());
  });
  await page.route(TRACKER_URL, async (route) => {
    await route.abort();
  });

  // Keep the browser URL on the real canonical origin, while serving every page
  // and asset from the local preview server. No request reaches production.
  for (const host of CANONICAL_HOSTS) {
    await page.route(`https://${host}/**`, async (route) => {
      const requested = new URL(route.request().url());
      const localUrl = new URL(`${requested.pathname}${requested.search}`, localOrigin).toString();
      const localResponse = await route.fetch({ url: localUrl });
      await route.fulfill({ response: localResponse });
    });
  }

  for (const host of CANONICAL_HOSTS) {
    for (const path of PUBLIC_PATHS) {
      await page.goto(`https://${host}${path}`, { waitUntil: 'networkidle' });
      expect(new URL(page.url()).hostname).toBe(host);
      await expect(page.locator(TRACKER_SCRIPTS)).toHaveCount(0);
      const trackingCookies = (await page.context().cookies()).filter((cookie) => TRACKER_COOKIES.test(cookie.name));
      expect(trackingCookies).toEqual([]);
      expect(await page.evaluate(() => ({
        gtag: Reflect.has(window, 'gtag'),
        clarity: Reflect.has(window, 'clarity'),
        dataLayer: Reflect.has(window, 'dataLayer')
      }))).toEqual({ gtag: false, clarity: false, dataLayer: false });

      if (path === '/website-use/') {
        await expect(page.getByText(/Google Analytics 4 and Microsoft Clarity are not loaded in this deployment/i)).toBeVisible();
      }
    }
  }

  expect(trackingRequests).toEqual([]);
});
