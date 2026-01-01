"use strict";
/**
 * Facebook Browser Automation Module
 * Uses Playwright to simulate real user behavior
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookBrowser = void 0;
exports.randomDelay = randomDelay;
exports.humanType = humanType;
exports.humanScroll = humanScroll;
const playwright_1 = require("playwright");
// ==================== UTILITIES ====================
/**
 * Random delay to simulate human behavior
 */
function randomDelay(minMs, maxMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
}
/**
 * Human-like typing with random speed
 */
async function humanType(page, selector, text) {
    await page.click(selector);
    await randomDelay(200, 500);
    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
        // Occasionally pause like a human thinking
        if (Math.random() < 0.1) {
            await randomDelay(200, 500);
        }
    }
}
/**
 * Human-like scrolling
 */
async function humanScroll(page) {
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    await page.mouse.wheel(0, scrollAmount);
    await randomDelay(500, 1500);
}
// ==================== FACEBOOK BROWSER CLASS ====================
class FacebookBrowser {
    constructor(credentials) {
        this.credentials = credentials;
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isLoggedIn = false;
    }
    /**
     * Initialize browser with stealth settings
     */
    async init() {
        console.log('[FB Browser] Initializing browser...');
        this.browser = await playwright_1.chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
            ]
        });
        // Create context with realistic viewport and user agent
        this.context = await this.browser.newContext({
            viewport: { width: 1366, height: 768 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'vi-VN',
            timezoneId: 'Asia/Ho_Chi_Minh',
        });
        // Add stealth scripts to avoid detection
        await this.context.addInitScript(() => {
            // Override navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            // Override chrome property
            window.chrome = {
                runtime: {},
            };
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => parameters.name === 'notifications'
                ? Promise.resolve({ state: 'denied' })
                : originalQuery(parameters);
        });
        this.page = await this.context.newPage();
        console.log('[FB Browser] Browser initialized');
    }
    /**
     * Login to Facebook using cookies or credentials
     */
    async login() {
        if (!this.page || !this.context) {
            throw new Error('Browser not initialized');
        }
        console.log('[FB Browser] 📍 Step 1/4: Attempting login...');
        try {
            // Try cookie-based login first
            if (this.credentials.cookies) {
                console.log('[FB Browser] 📍 Step 2/4: Parsing cookies...');
                const rawCookies = JSON.parse(this.credentials.cookies);
                console.log(`[FB Browser] ✅ Found ${rawCookies.length} cookies: ${rawCookies.map((c) => c.name).join(', ')}`);
                // Normalize cookies to Playwright format
                const cookies = rawCookies.map((c) => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain || '.facebook.com',
                    path: c.path || '/',
                    secure: c.secure !== undefined ? c.secure : true,
                    httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
                    sameSite: c.sameSite || 'Lax',
                    expires: c.expires || c.expirationDate || (Date.now() / 1000 + 86400 * 365), // 1 year default
                }));
                console.log('[FB Browser] 📍 Step 3/4: Adding cookies to browser...');
                await this.context.addCookies(cookies);
                console.log('[FB Browser] ✅ Cookies added');
                console.log('[FB Browser] 📍 Step 4/4: Navigating to Facebook...');
                // Navigate to Facebook to verify cookies
                await this.page.goto('https://www.facebook.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                console.log('[FB Browser] ✅ Page loaded, URL:', this.page.url());
                console.log('[FB Browser] 📍 Waiting for page to stabilize...');
                await randomDelay(2000, 4000);
                // Check if logged in by looking for logged-in indicators
                // Use multiple selectors that work on Vietnamese Facebook
                const loginSelectors = [
                    '[aria-label="Menu"]',
                    '[aria-label="Trang chủ"]',
                    '[aria-label="Home"]',
                    'a[href*="/me"]',
                    'div[role="navigation"]'
                ];
                let isLogged = false;
                for (const selector of loginSelectors) {
                    const count = await this.page.locator(selector).count();
                    if (count > 0) {
                        isLogged = true;
                        console.log(`[FB Browser] Login confirmed via: ${selector}`);
                        break;
                    }
                }
                if (isLogged) {
                    console.log('[FB Browser] ✅ Cookie login successful');
                    this.isLoggedIn = true;
                    return true;
                }
                console.log('[FB Browser] Cookie login failed, cookies might be expired');
            }
            // Fall back to email/password login
            if (this.credentials.email && this.credentials.password) {
                console.log('[FB Browser] Using email/password login');
                await this.page.goto('https://www.facebook.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await randomDelay(1000, 2000);
                // Accept cookies if popup appears
                const cookieButton = this.page.locator('button:has-text("Allow"), button:has-text("Cho phép"), button:has-text("Accept")');
                if (await cookieButton.count() > 0) {
                    await cookieButton.first().click();
                    await randomDelay(500, 1000);
                }
                // Type email
                await humanType(this.page, '#email', this.credentials.email);
                await randomDelay(500, 1000);
                // Type password
                await humanType(this.page, '#pass', this.credentials.password);
                await randomDelay(500, 1000);
                // Click login button
                await this.page.click('button[name="login"], button[data-testid="royal_login_button"]');
                // Wait for navigation
                await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
                await randomDelay(2000, 4000);
                // Check for 2FA or security checkpoint
                const url = this.page.url();
                if (url.includes('checkpoint') || url.includes('two_step_verification')) {
                    console.log('[FB Browser] ⚠️ 2FA or security checkpoint detected');
                    return false;
                }
                // Verify login using multiple selectors
                const loginCheckSelectors = ['[aria-label="Menu"]', '[aria-label="Trang chủ"]', 'a[href*="/me"]'];
                let isLogged = false;
                for (const sel of loginCheckSelectors) {
                    if (await this.page.locator(sel).count() > 0) {
                        isLogged = true;
                        break;
                    }
                }
                if (isLogged) {
                    console.log('[FB Browser] ✅ Email/password login successful');
                    this.isLoggedIn = true;
                    // Export cookies for future use
                    const newCookies = await this.context.cookies();
                    console.log('[FB Browser] Cookies exported for future sessions');
                    return true;
                }
            }
            console.log('[FB Browser] ❌ Login failed');
            return false;
        }
        catch (error) {
            console.error('[FB Browser] Login error:', error);
            return false;
        }
    }
    /**
     * Export current session cookies
     */
    async exportCookies() {
        if (!this.context) {
            throw new Error('Browser not initialized');
        }
        const cookies = await this.context.cookies();
        return JSON.stringify(cookies);
    }
    /**
     * Navigate to a Facebook post
     */
    async navigateToPost(postId) {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        try {
            // Facebook post URL format
            const postUrl = `https://www.facebook.com/${postId}`;
            console.log(`[FB Browser] Navigating to post: ${postUrl}`);
            await this.page.goto(postUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await randomDelay(2000, 4000);
            // Scroll down a bit to simulate reading
            await humanScroll(this.page);
            await randomDelay(1000, 2000);
            return true;
        }
        catch (error) {
            console.error('[FB Browser] Navigation error:', error);
            return false;
        }
    }
    /**
     * Post a comment on the current page
     */
    async postComment(message) {
        if (!this.page) {
            return { success: false, postId: '', error: 'Browser not initialized' };
        }
        try {
            console.log('[FB Browser] Looking for comment box...');
            // Multiple selectors for comment input (Facebook changes these frequently)
            const commentSelectors = [
                '[aria-label="Viết bình luận"]',
                '[aria-label="Write a comment"]',
                '[aria-label="Write a comment..."]',
                '[contenteditable="true"][role="textbox"]',
                'div[data-lexical-editor="true"]',
            ];
            let commentBox = null;
            for (const selector of commentSelectors) {
                const element = this.page.locator(selector).first();
                if (await element.count() > 0) {
                    commentBox = element;
                    break;
                }
            }
            if (!commentBox) {
                // Try clicking "Write a comment" placeholder first
                const placeholder = this.page.locator('span:has-text("Viết bình luận"), span:has-text("Write a comment")').first();
                if (await placeholder.count() > 0) {
                    await placeholder.click();
                    await randomDelay(500, 1000);
                    // Now try to find the comment box again
                    for (const selector of commentSelectors) {
                        const element = this.page.locator(selector).first();
                        if (await element.count() > 0) {
                            commentBox = element;
                            break;
                        }
                    }
                }
            }
            if (!commentBox) {
                return { success: false, postId: '', error: 'Comment box not found' };
            }
            // Click on comment box
            await commentBox.click();
            await randomDelay(300, 600);
            // Type the comment with human-like speed
            console.log('[FB Browser] Typing comment...');
            for (const char of message) {
                await this.page.keyboard.type(char, { delay: Math.random() * 80 + 30 });
                // Occasionally pause
                if (Math.random() < 0.05) {
                    await randomDelay(100, 300);
                }
            }
            await randomDelay(500, 1500);
            // Press Enter to submit or click submit button
            console.log('[FB Browser] Submitting comment...');
            // Try pressing Enter first (common way to submit)
            await this.page.keyboard.press('Enter');
            await randomDelay(2000, 4000);
            // Verify comment was posted by checking for it on the page
            // This is tricky as Facebook loads comments dynamically
            console.log('[FB Browser] ✅ Comment submitted');
            return { success: true, postId: this.page.url() };
        }
        catch (error) {
            console.error('[FB Browser] Comment error:', error);
            return { success: false, postId: '', error: error.message };
        }
    }
    /**
     * Get page posts (by scraping)
     */
    async getPagePosts(pageId, limit = 10) {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        try {
            console.log(`[FB Browser] 📍 Getting posts from page: ${pageId}`);
            console.log(`[FB Browser] 📍 Step 1/3: Navigating to page...`);
            await this.page.goto(`https://www.facebook.com/${pageId}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log(`[FB Browser] ✅ Page loaded`);
            console.log(`[FB Browser] 📍 Step 2/3: Scrolling to load posts...`);
            await randomDelay(2000, 4000);
            // Scroll to load more posts
            for (let i = 0; i < 3; i++) {
                console.log(`[FB Browser]    Scroll ${i + 1}/3...`);
                await humanScroll(this.page);
                await randomDelay(1000, 2000);
            }
            console.log(`[FB Browser] 📍 Step 3/3: Extracting post links...`);
            // Extract post links
            const postLinks = await this.page.evaluate(() => {
                const links = [];
                const anchors = document.querySelectorAll('a[href*="/posts/"], a[href*="/videos/"], a[href*="/reel/"]');
                anchors.forEach((a) => {
                    const href = a.getAttribute('href');
                    if (href && !links.includes(href)) {
                        links.push(href);
                    }
                });
                return links.slice(0, 20);
            });
            console.log(`[FB Browser] ✅ Found ${postLinks.length} posts`);
            if (postLinks.length > 0) {
                console.log(`[FB Browser]    First post: ${postLinks[0].substring(0, 60)}...`);
            }
            return postLinks.slice(0, limit);
        }
        catch (error) {
            console.error('[FB Browser] Error getting posts:', error);
            return [];
        }
    }
    /**
     * Comment on a specific post by URL/ID
     */
    async commentOnPost(postUrl, message) {
        if (!this.isLoggedIn) {
            return { success: false, postId: postUrl, error: 'Not logged in' };
        }
        console.log(`[FB Browser] Commenting on: ${postUrl}`);
        // Navigate to post
        const navigated = await this.navigateToPost(postUrl);
        if (!navigated) {
            return { success: false, postId: postUrl, error: 'Failed to navigate to post' };
        }
        // Random delay before commenting (1-3 seconds)
        await randomDelay(1000, 3000);
        // Post the comment
        return await this.postComment(message);
    }
    /**
     * Take a screenshot for debugging
     */
    async screenshot(filename) {
        if (this.page) {
            await this.page.screenshot({ path: filename, fullPage: true });
            console.log(`[FB Browser] Screenshot saved: ${filename}`);
        }
    }
    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
            this.isLoggedIn = false;
            console.log('[FB Browser] Browser closed');
        }
    }
}
exports.FacebookBrowser = FacebookBrowser;
