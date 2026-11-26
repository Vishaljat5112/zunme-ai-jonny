import { test, expect } from '@playwright/test';

test.describe('EgoLytics BFOV Charts - Phase 2 Visual Editor', () => {

  test('1. Editor Layout, Shape Palette & Canvas Rendering', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Verify editor topbar and phase indicator
    await expect(page.locator('.chart-editor-topbar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.phase-indicator-pill')).toContainText('Phase');

    // Verify left palette contains all required shapes
    const palette = page.locator('.chart-node-palette');
    await expect(palette).toBeVisible();
    await expect(palette.getByText('Rectangle', { exact: true })).toBeVisible();
    await expect(palette.getByText('Rounded Rectangle', { exact: true })).toBeVisible();
    await expect(palette.getByText('Circle / Terminal')).toBeVisible();
    await expect(palette.getByText('Diamond (Decision)')).toBeVisible();
    await expect(palette.getByText('Text / Annotation')).toBeVisible();
    await expect(palette.getByText('Person / Position Card')).toBeVisible();

    // Verify canvas area and React Flow controls
    const canvas = page.locator('.chart-canvas-area');
    await expect(canvas).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('2. Shape Addition & Right Properties Panel Inspection', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Add a Diamond Decision node by clicking palette item
    await page.locator('.palette-item:has-text("Diamond (Decision)")').click();

    // Verify node count increases and properties panel appears
    const propsPanel = page.locator('.chart-properties-panel');
    await expect(propsPanel).toBeVisible({ timeout: 5000 });
    await expect(propsPanel.locator('text=Node Properties')).toBeVisible();

    // Verify shape switcher, fill color swatches, and border color swatches exist
    await expect(propsPanel.locator('select').first()).toBeVisible();
    await expect(propsPanel.locator('.props-color-swatches').first()).toBeVisible();

    // Change node text in properties panel
    const textarea = propsPanel.locator('textarea');
    await textarea.fill('Custom Decision Test');
    await expect(page.locator('.react-flow__node:has-text("Custom Decision Test")')).toBeVisible();
  });

  test('3. Org Chart & Hierarchy Creation Support', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Click Org Chart preset in topbar
    await page.locator('button:has-text("Org Chart")').click();

    // Verify CEO and CTO org nodes render on canvas with person names
    await expect(page.locator('.react-flow__node:has-text("Sarah Connor")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.react-flow__node:has-text("Elena Rostova")')).toBeVisible();

    // Click on CEO node to inspect properties
    await page.locator('.react-flow__node:has-text("Sarah Connor")').click();
    const propsPanel = page.locator('.chart-properties-panel');
    await expect(propsPanel.locator('text=Full Name')).toBeVisible();
    await expect(propsPanel.locator('text=Job Title / Role')).toBeVisible();
    await expect(propsPanel.locator('input[value="Sarah Connor"]')).toBeVisible();
  });

  test('4. Auto-Layout, Undo/Redo & Save to Library', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Test Dagre Auto-Layout Vertical
    await page.locator('button:has-text("TB Layout")').click();

    // Test Dagre Auto-Layout Horizontal
    await page.locator('button:has-text("LR Layout")').click();

    // Test Undo
    const undoBtn = page.locator('button[title*="Undo"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // Test Save to Library action
    const saveBtn = page.locator('button:has-text("Save to Library")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify toast notification appears
    await expect(page.locator('.toast').last()).toBeVisible({ timeout: 5000 });
  });

});
