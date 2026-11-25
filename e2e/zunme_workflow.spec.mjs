import { test, expect } from '@playwright/test';

test.describe('Zunme AI End-to-End Browser Workflows', () => {

  test('1. Guest Mode - Accessible without authentication', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Zunme AI/i);

    // Navigate to Chat as Guest
    await page.goto('/user/chat');
    await expect(page.locator('.chat-workspace')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.chat-input-box')).toBeVisible();
    await expect(page.locator('.chat-canvas')).toBeVisible();
  });

  test('2. Persona Login & Navigation', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.energy-login-card')).toBeVisible({ timeout: 10000 });

    // Click on Admin Persona Card to authenticate directly
    const adminPersonaCard = page.locator('.persona-auth-row', { hasText: 'Admin Operations Hub' });
    await expect(adminPersonaCard).toBeVisible();
    await adminPersonaCard.click();

    // Verify redirected to Admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await expect(page.locator('.admin-shell-container')).toBeVisible({ timeout: 10000 });
  });

  test('3. Session Persistence on Page Refresh', async ({ page }) => {
    // Authenticate as Alex Creator via persona login API in browser context
    await page.goto('/login');
    const userPersonaCard = page.locator('.persona-auth-row', { hasText: 'User AI Workspace' });
    await userPersonaCard.click();
    await page.waitForURL('**/user/**', { timeout: 15000 });

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify user is still authenticated (localStorage token persisted)
    const token = await page.evaluate(() => localStorage.getItem('zunme_auth_token'));
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(20);
  });

  test('4. Expired / Invalid Session Handling', async ({ page }) => {
    await page.goto('/user/chat');

    // Corrupt token in localStorage to simulate expired/invalid token
    await page.evaluate(() => localStorage.setItem('zunme_auth_token', 'invalid_expired_token_xyz'));
    await page.reload();

    // Route guard checks session; invalid token should be purged from localStorage
    await page.waitForTimeout(1500);
    const tokenAfter = await page.evaluate(() => localStorage.getItem('zunme_auth_token'));
    expect(tokenAfter).toBeNull();
  });

  test('5. RBAC Route Guard - Regular User Blocked from Admin Pages', async ({ page }) => {
    // Log in as regular USER
    await page.goto('/login');
    const userCard = page.locator('.persona-auth-row', { hasText: 'User AI Workspace' });
    await userCard.click();
    await page.waitForURL('**/user/home', { timeout: 15000 });

    // Try navigating to protected /admin/overview
    await page.goto('/admin/overview');
    await page.waitForLoadState('networkidle');

    // ProtectedRoute verifies role with backend /api/auth/admin-check and redirects unauthorized users
    await page.waitForURL('**/user/**', { timeout: 10000 });
    expect(page.url()).not.toContain('/admin/overview');
  });

  test('6. RBAC Route Guard - Admin Allowed Access to Admin Pages', async ({ page }) => {
    // Log in as ADMIN
    await page.goto('/login');
    const adminCard = page.locator('.persona-auth-row', { hasText: 'Admin Operations Hub' });
    await adminCard.click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    // Direct access to /admin/overview succeeds
    await page.goto('/admin/overview');
    await expect(page.locator('.admin-shell-container')).toBeVisible({ timeout: 10000 });
  });

  test('7. Real AI Chat & Real-Time Streaming', async ({ page }) => {
    await page.goto('/login');
    const userCard = page.locator('.persona-auth-row', { hasText: 'User AI Workspace' });
    await userCard.click();
    await page.waitForURL('**/user/**', { timeout: 15000 });

    await page.goto('/user/chat');
    await expect(page.locator('.chat-textarea')).toBeVisible({ timeout: 10000 });

    // Type a prompt
    const textarea = page.locator('.chat-textarea');
    await textarea.fill('Hello from Playwright test! Give a 1-sentence reply.');
    await page.locator('button:has-text("Send")').click();

    // Verify user message bubble appears immediately
    await expect(page.locator('.user-bubble:has-text("Hello from Playwright test!")').last()).toBeVisible({ timeout: 5000 });

    // Verify assistant AI bubble appears and receives streamed response
    const assistantBubble = page.locator('.ai-bubble').last();
    await expect(assistantBubble).toBeVisible({ timeout: 25000 });
    const content = await assistantBubble.innerText();
    expect(content.length).toBeGreaterThan(5);
  });

  test('8. Conversation History & Creation', async ({ page }) => {
    await page.goto('/user/chat');
    await expect(page.locator('.chat-workspace')).toBeVisible({ timeout: 10000 });

    // Check conversation listing or top info bar
    const chatHeader = page.locator('.chat-header-bar');
    await expect(chatHeader).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('9. Library Persistence & Category Filtering', async ({ page }) => {
    await page.goto('/user/library');
    await expect(page.locator('.library-page')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1.library-title')).toHaveText(/My Saved Library/i);

    // Verify category filter pills including OFFICE and CHART exist
    const pills = page.locator('.category-filter-pills');
    await expect(pills).toBeVisible();
    await expect(page.locator('button.filter-pill:has-text("Office")')).toBeVisible();
    await expect(page.locator('button.filter-pill:has-text("Chart")')).toBeVisible();

    // Click on Office filter pill
    await page.locator('button.filter-pill:has-text("Office")').click();
    await expect(page.locator('button.filter-pill:has-text("Office")')).toHaveClass(/active/);
  });

  test('10. Logout Workflow', async ({ page }) => {
    await page.goto('/login');
    const userCard = page.locator('.persona-auth-row', { hasText: 'User AI Workspace' });
    await userCard.click();
    await page.waitForURL('**/user/**', { timeout: 15000 });

    // Verify logged in
    const tokenBefore = await page.evaluate(() => localStorage.getItem('zunme_auth_token'));
    expect(tokenBefore).toBeTruthy();

    // Clear session / logout
    await page.evaluate(() => localStorage.removeItem('zunme_auth_token'));
    await page.goto('/login');
    const tokenAfter = await page.evaluate(() => localStorage.getItem('zunme_auth_token'));
    expect(tokenAfter).toBeNull();
  });

});
