import mysql from 'mysql2/promise';

const BASE_URL = 'http://localhost:5000/api';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'ai-jonny'
};

async function loginPersona(persona) {
  const res = await fetch(`${BASE_URL}/auth/persona-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona })
  });
  const data = await res.json();
  if (!data.token) {
    throw new Error(`Persona login failed for ${persona}: ${JSON.stringify(data)}`);
  }
  return { token: data.token, user: data.user };
}

async function registerTestUser(name, email, password = 'TestPassword123!') {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!data.token) {
    throw new Error(`Registration failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { token: data.token, user: data.user };
}

async function request(endpoint, token, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, body: text };
  }
}

async function runStep4Tests() {
  console.log('====================================================');
  console.log('CRM nErgy Step 4 Automated Verification Suite');
  console.log('AI Research, Admin & Super Admin Controls');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const pool = await mysql.createPool(DB_CONFIG);

  try {
    // Authenticate test users
    console.log('--- Setup: Authenticating Users ---');
    const ts = Date.now();
    const userA = await registerTestUser('CRM Tester A', `crm_a_${ts}@test.com`);
    const userB = await registerTestUser('CRM Tester B', `crm_b_${ts}@test.com`);
    const admin = await loginPersona('admin');
    const superAdmin = await loginPersona('super_admin');

    console.log(`  User A (ID: ${userA.user.id}, Role: ${userA.user.role})`);
    console.log(`  User B (ID: ${userB.user.id}, Role: ${userB.user.role})`);
    console.log(`  Admin (ID: ${admin.user.id}, Role: ${admin.user.role})`);
    console.log(`  Super Admin (ID: ${superAdmin.user.id}, Role: ${superAdmin.user.role})`);

    // Clean test data for test users
    await pool.query('DELETE FROM crm_activities WHERE user_id IN (?, ?)', [userA.user.id, userB.user.id]);
    await pool.query('DELETE FROM crm_tasks WHERE user_id IN (?, ?)', [userA.user.id, userB.user.id]);
    await pool.query('DELETE FROM crm_projects WHERE user_id IN (?, ?)', [userA.user.id, userB.user.id]);
    await pool.query('DELETE FROM crm_deals WHERE user_id IN (?, ?)', [userA.user.id, userB.user.id]);
    await pool.query('DELETE FROM crm_contacts WHERE user_id IN (?, ?)', [userA.user.id, userB.user.id]);
    // Ensure module is enabled at start
    await pool.query(
      `INSERT INTO platform_settings (id, setting_key, setting_value, updated_by)
       VALUES ('set_crm_init', 'crm_module_enabled', 'true', 'System')
       ON DUPLICATE KEY UPDATE setting_value = 'true'`
    );

    // Seed User A with test CRM records
    const contactRes = await request('/crm/contacts', userA.token, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@novatech.com',
        company: 'NovaTech Solutions',
        role: 'Chief Technology Officer',
        type: 'LEAD',
        status: 'NEW',
        score: 85,
        estimatedValue: 60000
      })
    });
    const contactId = contactRes.body.contact?.id;

    const dealRes = await request('/crm/deals', userA.token, {
      method: 'POST',
      body: JSON.stringify({
        contactId,
        title: 'NovaTech Enterprise Cloud Suite',
        value: 60000,
        stage: 'PROPOSAL_SENT',
        probability: 60
      })
    });
    const dealId = dealRes.body.deal?.id;

    // Create overdue task for User A
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const overdueTaskId = `task_overdue_${Date.now()}`;
    await pool.query(
      `INSERT INTO crm_tasks (id, tenant_id, user_id, related_type, related_id, title, priority, status, due_date)
       VALUES (?, 'global', ?, 'DEAL', ?, 'Urgent: Submit Security Architecture Spec', 'URGENT', 'PENDING', ?)`,
      [overdueTaskId, userA.user.id, dealId, yesterday]
    );

    // --- TEST 1: Public Module Status Endpoint ---
    console.log('\n--- Test 1: Public Module Status Endpoint ---');
    const statusRes = await request('/crm/status', null, { method: 'GET' });
    assert(statusRes.status === 200, `GET /api/crm/status returned 200 (got ${statusRes.status})`);
    assert(statusRes.body.success === true, 'Response success is true');
    assert(statusRes.body.enabled === true, 'Module is enabled');
    assert(statusRes.body.module === 'CRM nErgy', 'Module name is CRM nErgy');

    // --- TEST 2: Bestie AI CRM Copilot Quick Actions ---
    console.log('\n--- Test 2: Bestie AI CRM Copilot Quick Actions ---');

    // 2a. Pipeline Health Analysis
    const pipelineRes = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'PIPELINE_ANALYSIS' })
    });
    assert(pipelineRes.status === 200, `Pipeline Analysis returned 200 (got ${pipelineRes.status})`);
    assert(pipelineRes.body.action === 'PIPELINE_ANALYSIS', 'Action matches PIPELINE_ANALYSIS');
    assert(typeof pipelineRes.body.response === 'string', 'Response contains grounded analysis string');
    assert(pipelineRes.body.response.includes('NovaTech Enterprise Cloud Suite') || pipelineRes.body.response.includes('60,000'), 'Analysis reflects User A real pipeline values');
    assert(pipelineRes.body.data?.totalDeals === 1, 'Data totalDeals accurately calculated as 1');

    // 2b. Lead Qualification (BANT)
    const bantRes = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'LEAD_QUALIFICATION' })
    });
    assert(bantRes.status === 200, `BANT Qualification returned 200 (got ${bantRes.status})`);
    assert(bantRes.body.action === 'LEAD_QUALIFICATION', 'Action matches LEAD_QUALIFICATION');
    assert(bantRes.body.response.includes('Elena Rostova'), 'Response includes User A lead Elena Rostova');
    assert(bantRes.body.data?.hotCount === 1, 'Elena Rostova (score 85) correctly tiered as Hot');

    // 2c. Overdue Task Summaries
    const overdueRes = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'OVERDUE_TASKS' })
    });
    assert(overdueRes.status === 200, `Overdue Tasks returned 200 (got ${overdueRes.status})`);
    assert(overdueRes.body.action === 'OVERDUE_TASKS', 'Action matches OVERDUE_TASKS');
    assert(overdueRes.body.response.includes('Submit Security Architecture Spec'), 'Response flags the overdue task');
    assert(overdueRes.body.data?.criticalCount >= 1, `Flags critical priority overdue task (got ${overdueRes.body.data?.criticalCount})`);

    // 2d. Prospect Research
    const researchRes = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'PROSPECT_RESEARCH', query: 'Acme Cloud Dynamics' })
    });
    assert(researchRes.status === 200, `Prospect Research returned 200 (got ${researchRes.status})`);
    assert(researchRes.body.action === 'PROSPECT_RESEARCH', 'Action matches PROSPECT_RESEARCH');
    assert(Boolean(researchRes.body.structuredProspect), 'Returns structuredProspect payload for 1-click write approval');
    assert(researchRes.body.structuredProspect.company === 'Acme Cloud Dynamics', 'Structured prospect matches queried company');

    // 2e. Conversational Grounded Query
    const chatRes = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'CHAT', query: 'Give me a brief overview of my sales status' })
    });
    assert(chatRes.status === 200, `Chat returned 200 (got ${chatRes.status})`);
    assert(chatRes.body.response.includes('60,000') || chatRes.body.response.includes('NovaTech'), 'Grounded response includes user real metrics');

    // --- TEST 3: User Explicit Approval: Save Prospect to Contacts ---
    console.log('\n--- Test 3: User Explicit Approval: Save Prospect to Contacts ---');
    const prospect = researchRes.body.structuredProspect;
    const saveProspectRes = await request('/crm/contacts', userA.token, {
      method: 'POST',
      body: JSON.stringify({
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
        company: prospect.company,
        role: prospect.role,
        type: 'LEAD',
        status: 'NEW',
        score: prospect.leadScore || 82,
        estimatedValue: prospect.estimatedValue || 75000,
        notes: prospect.notes
      })
    });
    assert(saveProspectRes.status === 201, `Save prospect returned 201 Created (got ${saveProspectRes.status})`);
    assert(saveProspectRes.body.contact?.company === 'Acme Cloud Dynamics', 'Prospect saved with accurate company');
    assert(saveProspectRes.body.contact?.userId === userA.user.id, 'Prospect strictly scoped to User A');

    // --- TEST 4: Cross-User Isolation in Bestie AI Copilot ---
    console.log('\n--- Test 4: Cross-User Isolation in Bestie AI Copilot ---');
    const userB_Pipeline = await request('/crm/ai/copilot', userB.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'PIPELINE_ANALYSIS' })
    });
    assert(userB_Pipeline.status === 200, 'User B pipeline analysis succeeds');
    assert(userB_Pipeline.body.data?.totalDeals === 0, 'User B sees 0 deals (isolated from User A)');
    assert(!userB_Pipeline.body.response.includes('NovaTech'), 'Zero data leakage: User B response has no mention of NovaTech');

    const userB_Bant = await request('/crm/ai/copilot', userB.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'LEAD_QUALIFICATION' })
    });
    assert(userB_Bant.body.data?.leads?.length === 0, 'User B sees 0 leads in BANT qualification');
    assert(!userB_Bant.body.response.includes('Elena Rostova'), 'Zero data leakage: User B response has no mention of Elena');

    // --- TEST 5: Admin Aggregate Telemetry Endpoint ---
    console.log('\n--- Test 5: Admin Aggregate Telemetry Endpoint ---');
    // Non-admin user blocked
    const forbiddenStats = await request('/admin/crm/stats', userA.token, { method: 'GET' });
    assert(forbiddenStats.status === 403, `Non-admin user blocked with 403 (got ${forbiddenStats.status})`);

    // Admin allowed
    const adminStats = await request('/admin/crm/stats', admin.token, { method: 'GET' });
    assert(adminStats.status === 200, `Admin access returned 200 (got ${adminStats.status})`);
    assert(adminStats.body.success === true, 'Admin stats success is true');
    assert(typeof adminStats.body.stats?.totalContacts === 'number', 'totalContacts is numeric');
    assert(typeof adminStats.body.stats?.totalDeals === 'number', 'totalDeals is numeric');
    assert(typeof adminStats.body.stats?.totalPipelineValue === 'number', 'totalPipelineValue is numeric');
    assert(typeof adminStats.body.stats?.activeCrmUsers === 'number', 'activeCrmUsers is numeric');
    assert(adminStats.body.stats.totalContacts >= 2, `Admin sees aggregated contacts count (>= 2, got ${adminStats.body.stats.totalContacts})`);
    assert(adminStats.body.stats.totalDeals >= 1, `Admin sees aggregated deals count (>= 1, got ${adminStats.body.stats.totalDeals})`);
    assert(!adminStats.body.stats.records, 'Admin stats strictly contains aggregate telemetry without exposing private user records');

    // --- TEST 6: Super Admin Module Availability Control ---
    console.log('\n--- Test 6: Super Admin Module Availability Control ---');
    // 6a. Super Admin toggles CRM module off
    const disableRes = await request('/admin/crm/settings', superAdmin.token, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false })
    });
    assert(disableRes.status === 200, 'Super Admin successfully updated module setting');
    assert(disableRes.body.enabled === false, 'Module setting is now disabled (false)');

    // 6b. Verify status reflects disabled
    const disabledStatus = await request('/crm/status', null, { method: 'GET' });
    assert(disabledStatus.body.enabled === false, 'GET /api/crm/status reports enabled: false');

    // 6c. Verify non-admin User A is blocked on CRM endpoints with 403
    const blockedContacts = await request('/crm/contacts', userA.token, { method: 'GET' });
    assert(blockedContacts.status === 403, `User A GET /api/crm/contacts blocked with 403 (got ${blockedContacts.status})`);
    assert(blockedContacts.body.error?.includes('disabled'), 'Error message states module is disabled');

    const blockedDeals = await request('/crm/deals', userA.token, { method: 'GET' });
    assert(blockedDeals.status === 403, `User A GET /api/crm/deals blocked with 403 (got ${blockedDeals.status})`);

    const blockedCopilot = await request('/crm/ai/copilot', userA.token, {
      method: 'POST',
      body: JSON.stringify({ action: 'CHAT', query: 'Status update' })
    });
    assert(blockedCopilot.status === 403, `User A POST /api/crm/ai/copilot blocked with 403 (got ${blockedCopilot.status})`);

    // 6d. Verify Admin/SuperAdmin retains operational bypass access
    const adminBypass = await request('/crm/contacts', admin.token, { method: 'GET' });
    assert(adminBypass.status === 200, `Admin retains operational bypass access (got ${adminBypass.status})`);

    // 6e. Super Admin re-enables CRM module
    const enableRes = await request('/admin/crm/settings', superAdmin.token, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true })
    });
    assert(enableRes.body.enabled === true, 'Module setting re-enabled (true)');

    // 6f. User A access cleanly restored
    const restoredContacts = await request('/crm/contacts', userA.token, { method: 'GET' });
    assert(restoredContacts.status === 200, 'User A access cleanly restored after module re-enabled');

    // --- TEST 7: EgoLytics BFOV Charts Regression ---
    console.log('\n--- Test 7: EgoLytics BFOV Charts Regression ---');
    const chartsStatus = await request('/charts/status', null, { method: 'GET' });
    assert(chartsStatus.status === 200, 'Charts status returns 200');
    assert(chartsStatus.body.success === true && chartsStatus.body.enabled === true, 'EgoLytics BFOV Charts remains fully operational');

    console.log('\n====================================================');
    console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Test execution failed with fatal error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runStep4Tests();
