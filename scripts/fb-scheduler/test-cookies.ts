/**
 * Test script to verify Facebook cookies
 * Run: npx ts-node test-cookies.ts
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testCookies() {
    console.log('🔍 Testing Facebook cookies...\n');

    // Get cookies from database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: config, error } = await supabase
        .from('fb_scheduler_config')
        .select('fb_cookies, page_id')
        .single();

    if (error || !config?.fb_cookies) {
        console.log('❌ No cookies found in database');
        console.log('Error:', error);
        return;
    }

    console.log('📦 Cookies từ database:', config.fb_cookies.substring(0, 100) + '...');

    let cookies;
    try {
        cookies = JSON.parse(config.fb_cookies);
        console.log(`✅ Parsed ${cookies.length} cookies:`, cookies.map((c: any) => c.name).join(', '));
    } catch (e) {
        console.log('❌ Invalid JSON:', e);
        return;
    }

    // Launch browser
    console.log('\n🌐 Launching browser...');
    const browser = await chromium.launch({
        headless: false, // Show browser for debugging
        slowMo: 500
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Add cookies
    console.log('🍪 Adding cookies...');
    await context.addCookies(cookies);

    const page = await context.newPage();

    // Navigate to Facebook
    console.log('📄 Navigating to Facebook...');
    await page.goto('https://www.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait a bit for page to load
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'debug-login.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-login.png');

    // Get current URL
    const url = page.url();
    console.log('🔗 Current URL:', url);

    // Check various login indicators
    console.log('\n🔍 Checking login status...');

    // Method 1: Check URL
    if (url.includes('login') || url.includes('checkpoint')) {
        console.log('❌ URL indicates not logged in or checkpoint');
    } else {
        console.log('✅ URL looks good (not login/checkpoint)');
    }

    // Method 2: Look for various logged-in elements
    const selectors = [
        '[aria-label="Tài khoản của bạn"]',
        '[aria-label="Your account"]',
        '[aria-label="Account"]',
        '[aria-label="Menu"]',
        '[aria-label="Trang chủ"]',
        '[aria-label="Home"]',
        '[data-pagelet="LeftRail"]',
        'div[role="navigation"]',
        'a[href*="/me"]',
    ];

    for (const selector of selectors) {
        const count = await page.locator(selector).count();
        console.log(`  ${count > 0 ? '✅' : '❌'} ${selector}: ${count} found`);
    }

    // Get page title
    const title = await page.title();
    console.log('\n📑 Page title:', title);

    // Get any error messages
    const errorMessages = await page.locator('text=/error|lỗi|Đăng nhập|Log in/i').allTextContents();
    if (errorMessages.length > 0) {
        console.log('\n⚠️ Possible error messages found:', errorMessages.slice(0, 3));
    }

    // Wait for user to see
    console.log('\n⏳ Browser will stay open for 30 seconds for debugging...');
    await page.waitForTimeout(30000);

    await browser.close();
    console.log('\n✅ Test complete!');
}

testCookies().catch(console.error);
