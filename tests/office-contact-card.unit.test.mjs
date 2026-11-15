import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [siteRaw, page, vcfBuffer] = await Promise.all([
  readFile(new URL('../src/data/site.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8'),
  readFile(new URL('../public/donovan-family-dentistry.vcf', import.meta.url)),
]);
const site = JSON.parse(siteRaw);
const vcf = vcfBuffer.toString('utf8');

test('Classic office contact card renders from the approved site data and preserves its working actions', () => {
  assert.match(page, /site\.logo/);
  assert.match(page, /site\.practiceName/);
  assert.match(page, /site\.phoneDisplay/);
  assert.match(page, /site\.phoneHref/);
  assert.match(page, /site\.address/);
  assert.match(page, /site\.contactEmail/);
  assert.match(page, /site\.hours/);
  assert.match(page, /href="\/donovan-family-dentistry\.vcf" download/);
  assert.match(page, /aria-label="Office contact actions"/);
  assert.match(page, /href=\{mapHref\}/);
  assert.ok(site.practiceName && site.logo && site.phoneHref && site.address && site.hours.length > 0);
});

test('public office vCard is CRLF-delimited v3.0 with required fields and site data parity', () => {
  assert.equal(vcfBuffer.toString('binary').replace(/\r\n/g, '').includes('\n'), false, 'vCard uses CRLF line endings');
  assert.match(vcf, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/m);
  assert.match(vcf, /^N:;;;;\r\n/m, 'organization contact has a structured N field without inventing a person');
  assert.match(vcf, new RegExp(`^FN:${site.practiceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r$`, 'm'));
  assert.match(vcf, new RegExp(`^ORG:${site.practiceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r$`, 'm'));
  assert.match(vcf, new RegExp(`^TEL;TYPE=WORK,VOICE:${site.phoneHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r$`, 'm'));
  assert.ok(vcf.includes(`${site.address.street};${site.address.city};${site.address.state};${site.address.postalCode};USA`));
  assert.ok(vcf.includes(site.contactEmail));
  assert.match(vcf, /^NOTE:Office hours /m);
  const vcfLines = vcf.split('\r\n');
  const noteIndex = vcfLines.findIndex((line) => line.startsWith('NOTE:'));
  assert.notEqual(noteIndex, -1, 'vCard includes the office-hours NOTE');
  const noteLines = [vcfLines[noteIndex]];
  let nextNoteLine = noteIndex + 1;
  while (vcfLines[nextNoteLine]?.startsWith(' ')) noteLines.push(vcfLines[nextNoteLine++]);
  assert.equal(noteLines.length, 1, 'the concise office-hours NOTE does not need folding');
  assert.ok(vcfLines.filter(Boolean).every((line) => Buffer.byteLength(line, 'utf8') <= 75), 'vCard lines stay within 75 octets');
  assert.equal(noteLines[0], 'NOTE:Office hours Mon-Thu 7:30 AM-5:00 PM; Fri-Sun closed.');
  assert.match(vcf, /\r\nEND:VCARD\r\n$/);
  assert.doesNotMatch(vcf, /PATIENT|DOB|DIAGNOSIS/i);
});
