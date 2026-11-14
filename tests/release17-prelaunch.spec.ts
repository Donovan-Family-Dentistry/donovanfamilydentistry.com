import { test, expect } from '@playwright/test';

test('/ keeps the final Classic desktop actions compact and presents both dentists', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const headerPhone = page.locator('.nav-call');
  await expect(headerPhone).toHaveText('(843) 525-6866');
  await expect(headerPhone).toHaveAttribute('href', 'tel:+18435256866');

  await expect(page.getByRole('heading', { name: 'Experienced dentists, comprehensive family care' })).toBeVisible();
  await expect(page.getByText(/Dr\. William Donovan and Dr\. Jordan Henke provide care for patients of all ages/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Meet the dentists' })).toHaveAttribute('href', '/about/');

  if (!isMobile) {
    const actions = [
      page.locator('.hero .actions > a').nth(0),
      page.locator('.hero .actions > a').nth(1),
      page.locator('.hero .actions > a').nth(2)
    ];
    const boxes = await Promise.all(actions.map((action) => action.boundingBox()));
    expect(boxes.every(Boolean)).toBeTruthy();
    const yValues = boxes.map((box) => box!.y);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeLessThan(4);

    const desktopNav = page.locator('.site-nav > a');
    const navMetrics = await desktopNav.evaluateAll((links) => links.map((link) => {
      const style = window.getComputedStyle(link);
      const range = document.createRange();
      range.selectNodeContents(link);
      return {
        whiteSpace: style.whiteSpace,
        textLineBoxes: [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).length,
        height: link.getBoundingClientRect().height
      };
    }));
    expect(navMetrics.every((metric) => metric.whiteSpace === 'nowrap')).toBeTruthy();
    expect(navMetrics.every((metric) => metric.textLineBoxes === 1)).toBeTruthy();
    expect(Math.max(...navMetrics.map((metric) => metric.height)) - Math.min(...navMetrics.map((metric) => metric.height))).toBeLessThan(2);
  }
});

test('/contact/ shows the verified office contact card, hours, email, and working actions', async ({ page }, testInfo) => {
  await page.goto('/contact/', { waitUntil: 'networkidle' });

  const saveContact = page.getByRole('link', { name: 'Save Contact' });
  await expect(saveContact).toBeVisible();
  await expect(saveContact).toHaveAttribute('href', '/donovan-family-dentistry.vcf');
  await expect(saveContact).toHaveAttribute('download', '');
  await expect(page.locator('.office-contact-card').getByRole('heading', { name: 'Donovan Family Dentistry' })).toBeVisible();
  await expect(page.getByText(/Open the downloaded contact file and choose Add or Save to Contacts/i)).toBeVisible();
  await expect(page.locator('.office-contact-actions a[href="tel:+18435256866"]')).toHaveAttribute('aria-label', 'Call Donovan Family Dentistry at (843) 525-6866');
  await expect(page.locator('.office-contact-actions').getByRole('link', { name: 'Directions' })).toHaveAttribute('href', /google\.com\/maps\/search/);

  await expect(page.locator('.office-contact-card')).toContainText('91 Sams Point Road');
  await expect(page.locator('.office-contact-card')).toContainText('Mon–Thu 7:30 AM–5:00 PM · Fri–Sun closed');

  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday']) {
    const row = page.getByRole('row', { name: new RegExp(`${day}\\s+7:30 AM-5:00 PM`, 'i') });
    await expect(row).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'dfdbeaufort@gmail.com' })).toHaveAttribute('href', 'mailto:dfdbeaufort@gmail.com');

  await page.screenshot({
    path: testInfo.outputPath('release17-prelaunch-classic-contact-hours.png'),
    fullPage: true
  });
});

test('/contact/ office card remains readable from narrow mobile through desktop widths', async ({ page }) => {
  await page.goto('/contact/', { waitUntil: 'networkidle' });
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      actions: [...document.querySelectorAll('.office-contact-actions a')].map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: (anchor.textContent || '').trim(), visible: rect.width > 0 && rect.height > 0 };
      }),
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.actions).toHaveLength(3);
    expect(dimensions.actions.every((action) => action.visible && action.height >= 48 && action.width >= 44 && action.text.length > 0)).toBeTruthy();
  }
});

test('/modern/contact/ remains a noindex future-design demo with matching contact details', async ({ page }) => {
  await page.goto('/modern/contact/', { waitUntil: 'networkidle' });

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText('Future design demo. Not the current public website.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Monday\s+7:30 AM-5:00 PM/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /dfdbeaufort@gmail.com/i })).toHaveAttribute('href', 'mailto:dfdbeaufort@gmail.com');
});

test('production robots policy allows Classic crawling and advertises the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toBe('User-agent: *\nAllow: /\nSitemap: https://donovanfamilydentistry.com/sitemap.xml\n');
});

test('the public sitemap contains Classic routes only', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBeTruthy();
  const body = await response.text();

  expect(body).toContain('<loc>https://donovanfamilydentistry.com/</loc>');
  expect(body).toContain('/about/');
  expect(body).toContain('/services/');
  expect(body).toContain('/forms/');
  expect(body).toContain('/contact/');
  expect(body).not.toContain('/modern/');
  expect(body).not.toContain('/review/');
});
