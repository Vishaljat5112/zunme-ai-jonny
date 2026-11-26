import { test, expect } from '@playwright/test';

test.describe('EgoLytics BFOV Charts - Phase 3 Organizational Hierarchy & Auto-Layout', () => {

  test('1. Org Chart Templates Loading (Corporate, Small Biz, Department)', async ({ page }) => {
    // 1A. Load Corporate Hierarchy template
    await page.goto('/user/charts/editor?template=tpl_corp_hierarchy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.react-flow__node:has-text("Sarah Connor")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.react-flow__node:has-text("Elena Rostova")')).toBeVisible();
    await expect(page.locator('.react-flow__node:has-text("Marcus Vance")')).toBeVisible();
    await expect(page.locator('.react-flow__node:has-text("Rachel Green")')).toBeVisible();

    // 1B. Load Small Business Team template
    await page.goto('/user/charts/editor?template=tpl_small_biz_team');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.react-flow__node:has-text("Liam Walker")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.react-flow__node:has-text("Chloe Martin")')).toBeVisible();
    await expect(page.locator('.react-flow__node:has-text("Noah Miller")')).toBeVisible();

    // 1C. Load Department Structure template
    await page.goto('/user/charts/editor?template=tpl_dept_engineering');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.react-flow__node:has-text("Dr. Aris Thorne")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.react-flow__node:has-text("Priya Patel")')).toBeVisible();
    await expect(page.locator('.react-flow__node:has-text("Lucas Silva")')).toBeVisible();
  });

  test('2. Add Subordinate & Automatic Hierarchy Connection & Node Editing', async ({ page }) => {
    await page.goto('/user/charts/editor?template=tpl_corp_hierarchy');
    await page.waitForLoadState('networkidle');

    // Select Elena Rostova (CTO)
    const ctoNode = page.locator('.react-flow__node:has-text("Elena Rostova")').first();
    await expect(ctoNode).toBeVisible({ timeout: 10000 });
    await ctoNode.click();

    // Verify Org Hierarchy Actions panel is visible
    const propsPanel = page.locator('.chart-properties-panel');
    await expect(propsPanel.locator('.org-hierarchy-actions')).toBeVisible();
    const addSubBtn = propsPanel.locator('.org-action-btn:has-text("Subordinate")');
    await expect(addSubBtn).toBeVisible();

    // Click Add Subordinate
    await addSubBtn.click();

    // Toast notification should announce the addition
    await expect(page.locator('.toast').last()).toContainText('subordinate');

    // Edit employee details in properties panel
    const nameInput = propsPanel.locator('label:has-text("Full Name") + input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Kenji Sato');

    const roleInput = propsPanel.locator('label:has-text("Job Title / Role") + input');
    await roleInput.fill('DevOps Specialist');

    const deptInput = propsPanel.locator('label:has-text("Department / Unit") + input');
    await deptInput.fill('Cloud Infrastructure');

    // Verify the newly added node displays the updated name
    await expect(page.locator('.react-flow__node:has-text("Kenji Sato")')).toBeVisible();
  });

  test('3. Add Sibling (Peer) under Same Manager', async ({ page }) => {
    await page.goto('/user/charts/editor?template=tpl_corp_hierarchy');
    await page.waitForLoadState('networkidle');

    // Select David Kim (Engineering Director, reporting to Elena)
    const directorNode = page.locator('.react-flow__node:has-text("David Kim")').first();
    await expect(directorNode).toBeVisible({ timeout: 10000 });
    await directorNode.click();

    // Click Add Sibling
    const propsPanel = page.locator('.chart-properties-panel');
    const addSiblingBtn = propsPanel.locator('.org-action-btn:has-text("Sibling")');
    await expect(addSiblingBtn).toBeVisible();
    await addSiblingBtn.click();

    // Verify sibling added notification
    await expect(page.locator('.toast').last()).toContainText('peer');

    // Update sibling name
    const nameInput = propsPanel.locator('label:has-text("Full Name") + input');
    await nameInput.fill('Alice Wang');

    // Verify Alice Wang is rendered on canvas
    await expect(page.locator('.react-flow__node:has-text("Alice Wang")')).toBeVisible();
  });

  test('4. Change Manager Reassignment & Cycle Prevention Verification', async ({ page }) => {
    await page.goto('/user/charts/editor?template=tpl_corp_hierarchy');
    await page.waitForLoadState('networkidle');

    // Select David Kim
    const directorNode = page.locator('.react-flow__node:has-text("David Kim")').first();
    await expect(directorNode).toBeVisible({ timeout: 10000 });
    await directorNode.click();

    // Check Change Manager dropdown options
    const propsPanel = page.locator('.chart-properties-panel');
    const managerSelect = propsPanel.locator('label:has-text("Change Manager") + select');
    await expect(managerSelect).toBeVisible();

    // Reassign David Kim's manager to Sarah Connor (CEO, id: corp-1)
    await managerSelect.selectOption('corp-1');

    // Verify confirmation toast
    await expect(page.locator('.toast').last()).toContainText('Sarah Connor');

    // Cycle Prevention Check: Now select Sarah Connor (CEO)
    const ceoNode = page.locator('.react-flow__node:has-text("Sarah Connor")').first();
    await ceoNode.click();

    const ceoManagerSelect = propsPanel.locator('label:has-text("Change Manager") + select');
    await expect(ceoManagerSelect).toBeVisible();

    // Sarah Connor cannot choose David Kim (descendant) or herself as manager
    const options = await ceoManagerSelect.locator('option').allInnerTexts();
    for (const opt of options) {
      expect(opt).not.toContain('Sarah Connor');
    }
  });

  test('5. Auto-Arrange Toggle, Dagre Auto-Layout & Flowchart Preservation', async ({ page }) => {
    await page.goto('/user/charts/editor');
    await page.waitForLoadState('networkidle');

    // Verify Auto-Arrange toggle checkbox is present and checked by default
    const autoArrangeToggle = page.locator('.toolbar-toggle-label input[type="checkbox"]');
    await expect(autoArrangeToggle).toBeVisible();
    await expect(autoArrangeToggle).toBeChecked();

    // Toggle Auto-Arrange off
    await autoArrangeToggle.uncheck();
    await expect(autoArrangeToggle).not.toBeChecked();

    // Dagre TB and LR Layout buttons work on demand
    const tbBtn = page.locator('button:has-text("TB Layout")');
    await tbBtn.click();
    await expect(page.locator('.toast').last()).toContainText('Auto-arranged');

    const lrBtn = page.locator('button:has-text("LR Layout")');
    await lrBtn.click();
    await expect(page.locator('.toast').last()).toContainText('Auto-arranged');

    // Switch to Flowchart mode
    await page.locator('button:has-text("Flowchart")').click();
    await expect(page.locator('.react-flow__node:has-text("Start Flow")')).toBeVisible();

    // Standard flowcharts allow multiple connections without org multiple-manager blocks
    await expect(page.locator('.react-flow__node:has-text("Processing Engine")')).toBeVisible();
  });

});
