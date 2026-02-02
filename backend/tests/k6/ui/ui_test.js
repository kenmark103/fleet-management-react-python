import { sleep, check, fail } from 'k6';
import http from 'k6/http';
import { browser } from 'k6/browser';

const BASE_URL = 'https://www.saucedemo.com';

export const options = {
  cloud: {
    projectID: 6549996,
    name: 'UI Test K6 Web Sample'
  },
  thresholds: {
        checks: ['rate==1.0'],
        'browser_web_vital_lcp': ['p(95)<2500'],
        'browser_http_req_failed': ['rate<0.20'],
    },
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      iterations: 2,
      vus: 2,
      options: {
        browser: { type: 'chromium' },
      },
    },
  },
};

export function setup() {
  const res = http.get(BASE_URL);
  if (res.status !== 200) {
    fail(`Failed to fetch the page; status=${res.status}`);
  }
}

export default async function () {
  const page = await browser.newPage();
  const creds = { username: 'standard_user', password: 'secret_sauce' };

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.locator('#user-name').fill(creds.username);
    await page.locator('#password').fill(creds.password);
    await page.locator('#login-button').click();

    await page.waitForSelector('.title');
    const title = await page.locator('.title').textContent();

    check(title, {
      'Login Success': (t) => (t || '').trim() === 'Products',
    });
  } catch (error) {

    console.error('UI test error:', error && error.stack ? error.stack : error);
    fail(`Test failed with error: ${error && error.message ? error.message : error}`);
  } finally {
    await page.close();
  }

  sleep(1);
}