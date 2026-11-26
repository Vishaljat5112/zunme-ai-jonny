import { test, expect } from '@playwright/test';

test.describe.serial('EgoLytics BFOV Charts - Phase 4 Backend, Database & My Charts Integration', () => {

  const testTitle = `E2E Phase 4 Pipeline ${Date.now()}`;
  let savedChartId = '';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const userPersonaCard = page.locator('.persona-auth-row', { hasText: 'User AI Workspace' });
    if (await userPersonaCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userPersonaCard.click();
      await page.waitForURL('**/user/**', { timeout: 15000 });
    }
  });

  test('1. Create and Save Diagram to Real MySQL Backend Library', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Verify topbar indicator shows Phase 4
    await expect(page.locator('.phase-indicator-pill')).toContainText('Phase 4');

    // Set custom diagram title
    const titleInput = page.locator('.chart-editor-topbar input[type="text"]');
    await titleInput.fill(testTitle);

    // Verify Unsaved badge appears
    await expect(page.locator('.chart-status-badge.unsaved')).toBeVisible();

    // Add a diamond decision shape
    await page.locator('.palette-item:has-text("Diamond (Decision)")').click();
    await expect(page.locator('.react-flow__node:has-text("Valid?")')).toBeVisible();

    // Click Save to Library
    const saveBtn = page.locator('button:has-text("Save to Library")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify success toast appears
    await expect(page.locator('.toast').last()).toContainText('Saved');

    // Verify URL was updated with chartId query param
    await page.waitForURL(/chartId=lib_/);
    const currentUrl = page.url();
    const match = currentUrl.match(/chartId=(lib_[a-zA-Z0-9]+)/);
    expect(match).not.toBeNull();
    savedChartId = match[1];

    // Verify Saved status indicator and button changes to "Save Changes"
    await expect(page.locator('.chart-status-badge.saved')).toBeVisible();
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
  });

  test('2. Update Same Record in Place Without Duplication', async ({ page }) => {
    expect(savedChartId).toBeTruthy();

    await page.goto(`/user/charts/editor?chartId=${savedChartId}`);
    await page.waitForLoadState('networkidle');

    // Title should match our saved chart
    const titleInput = page.locator('.chart-editor-topbar input[type="text"]');
    await expect(titleInput).toHaveValue(testTitle);

    // Update title
    const updatedTitle = `${testTitle} (Updated)`;
    await titleInput.fill(updatedTitle);

    // Verify Unsaved badge appears
    await expect(page.locator('.chart-status-badge.unsaved')).toBeVisible();

    // Click Save Changes
    const saveChangesBtn = page.locator('button:has-text("Save Changes")');
    await saveChangesBtn.click();

    // Confirmation toast
    await expect(page.locator('.toast').last()).toContainText('Saved changes');
    await expect(page.locator('.chart-status-badge.saved')).toBeVisible();

    // Navigate to My Charts and verify only ONE record exists (no duplicate created!)
    await page.goto('/user/charts/my-charts');
    await page.waitForLoadState('networkidle');

    const matchingCards = page.locator(`.chart-template-card:has-text("${updatedTitle}")`);
    await expect(matchingCards).toHaveCount(1);

    // Ensure the old title no longer exists as a duplicate
    const oldCards = page.locator(`.chart-template-card h3:text-is("${testTitle}")`);
    await expect(oldCards).toHaveCount(0);
  });

  test('3. Reopen Diagram and Full Restoration After Page Refresh', async ({ page }) => {
    expect(savedChartId).toBeTruthy();

    // Reopen from My Charts
    await page.goto('/user/charts/my-charts');
    await page.waitForLoadState('networkidle');

    const chartCard = page.locator(`.chart-template-card:has-text("${testTitle}")`).first();
    await expect(chartCard).toBeVisible();
    await chartCard.click();

    // Check we navigated to editor with chartId
    await page.waitForURL(new RegExp(`chartId=${savedChartId}`));
    await expect(page.locator('.chart-status-badge.saved')).toBeVisible();

    // Hard page refresh to verify database persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.chart-editor-topbar input[type="text"]')).toHaveValue(new RegExp(testTitle));
    await expect(page.locator('.react-flow__node:has-text("Valid?")')).toBeVisible();
    await expect(page.locator('.chart-status-badge.saved')).toBeVisible();
  });

  test('4. Duplicate, Rename and Delete Operations in My Charts', async ({ page }) => {
    expect(savedChartId).toBeTruthy();

    await page.goto('/user/charts/my-charts');
    await page.waitForLoadState('networkidle');

    const originalCard = page.locator(`.chart-template-card:has-text("${testTitle}")`).first();
    await expect(originalCard).toBeVisible();

    // 4A. Duplicate the chart
    const duplicateBtn = originalCard.locator('button[title="Duplicate diagram"]');
    await duplicateBtn.click();
    await expect(page.locator('.toast').last()).toContainText('Duplicated diagram');

    // Verify duplicate card appears with "(Copy)"
    const copyCard = page.locator('.chart-template-card:has-text("(Copy)")').first();
    await expect(copyCard).toBeVisible();

    // 4B. Rename the duplicate chart
    page.once('dialog', async (dialog) => {
      await dialog.accept('Renamed E2E Diagram');
    });
    const renameBtn = copyCard.locator('button[title="Rename diagram"]');
    await renameBtn.click();
    await expect(page.locator('.toast').last()).toContainText('Renamed');
    await expect(page.locator('.chart-template-card:has-text("Renamed E2E Diagram")')).toBeVisible();

    // 4C. Delete the renamed diagram
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    const deleteBtn = page.locator('.chart-template-card:has-text("Renamed E2E Diagram") button[title="Delete diagram"]');
    await deleteBtn.click();
    await expect(page.locator('.toast').last()).toContainText('Removed');
    await expect(page.locator('.chart-template-card:has-text("Renamed E2E Diagram")')).toHaveCount(0);
  });

  test('5. Cross-User Isolation & Malformed Data Rejection', async ({ page, request }) => {
    // 5A. Attempting to reopen a non-existent or foreign chart ID is blocked
    await page.goto('/user/charts/editor?chartId=lib_unauthorized_test_foreign_id');
    await page.waitForLoadState('networkidle');

    // Should display toast and redirect to My Charts
    await expect(page.locator('.toast').last()).toContainText(/unauthorized|not found/i);
    await page.waitForURL(/\/user\/charts\/my-charts/);

    // 5B. Safe rejection of malformed chart JSON via API
    // Attempting to POST malformed content to /api/library
    const token = await page.evaluate(() => localStorage.getItem('zunme_auth_token'));
    const response = await request.post('http://localhost:5000/api/library', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      data: {
        title: 'Malformed Test Chart',
        contentType: 'CHART',
        content: 'NOT_A_JSON_STRING_BROKEN',
        previewText: 'Broken spec test'
      }
    });

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);
    const errBody = await response.json();
    expect(errBody.success).toBe(false);
    expect(errBody.error).toContain('JSON');
  });

});
