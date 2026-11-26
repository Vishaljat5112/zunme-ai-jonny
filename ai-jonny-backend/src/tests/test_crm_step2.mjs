/**
 * CRM nErgy Step 2 Verification Script
 * Validates:
 * 1. Unauthenticated rejection (401)
 * 2. User A registration/login
 * 3. Contact & Partner creation and type filtering
 * 4. Deal creation, contact linkage, and stage progression
 * 5. Dynamic database metrics calculation
 * 6. Strict cross-user data isolation (User B cannot see or modify User A records)
 * 7. CSV bulk import into real database
 * 8. Internal CRM data source tag for AI live tools
 */

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('CRM nErgy Step 2 - Targeted Verification Suite');
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

  // --- Test 1: Unauthenticated Rejection ---
  console.log('--- Test 1: Unauthenticated API Access Protection ---');
  const unauthMetrics = await request('/api/crm/metrics');
  assert(unauthMetrics.status === 401, 'Unauthenticated /api/crm/metrics returns 401');

  const unauthContacts = await request('/api/crm/contacts');
  assert(unauthContacts.status === 401, 'Unauthenticated /api/crm/contacts returns 401');

  const unauthDeals = await request('/api/crm/deals');
  assert(unauthDeals.status === 401, 'Unauthenticated /api/crm/deals returns 401');

  // --- Test 2: User A & User B Setup ---
  console.log('\n--- Test 2: User Registration & Authentication ---');
  const timestamp = Date.now();
  const userAEmail = `crm_test_a_${timestamp}@example.com`;
  const userBEmail = `crm_test_b_${timestamp}@example.com`;
  const password = 'TestPassword123!';

  const regA = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'CRM User A', email: userAEmail, password })
  });
  assert(regA.ok && regA.data.token, `User A registered successfully (${userAEmail})`);
  const tokenA = regA.data.token;
  const userA = regA.data.user;

  const regB = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'CRM User B', email: userBEmail, password })
  });
  assert(regB.ok && regB.data.token, `User B registered successfully (${userBEmail})`);
  const tokenB = regB.data.token;
  const userB = regB.data.user;

  const authHeadersA = { Authorization: `Bearer ${tokenA}` };
  const authHeadersB = { Authorization: `Bearer ${tokenB}` };

  // --- Test 3: Contacts & Partners CRUD for User A ---
  console.log('\n--- Test 3: Contacts & Partners Creation & Type Separation ---');
  const createContactA = await request('/api/crm/contacts', {
    method: 'POST',
    headers: authHeadersA,
    body: JSON.stringify({
      firstName: 'David',
      lastName: 'Sterling',
      email: `david_${timestamp}@apexsolutions.com`,
      company: 'Apex Solutions',
      jobTitle: 'VP of Technology',
      phone: '+1-555-0199',
      type: 'LEAD',
      status: 'QUALIFIED',
      estimatedValue: 48000,
      score: 85
    })
  });
  assert(createContactA.ok && createContactA.data?.contact?.id, 'User A created Lead Contact successfully');
  const contactAId = createContactA.data?.contact?.id;

  const createPartnerA = await request('/api/crm/contacts', {
    method: 'POST',
    headers: authHeadersA,
    body: JSON.stringify({
      firstName: 'Helena',
      lastName: 'Vance',
      email: `helena_${timestamp}@globalchannel.io`,
      company: 'Global Channel Partners',
      jobTitle: 'Alliances VP',
      type: 'PARTNER',
      status: 'ACTIVE',
      partnerTier: 'Platinum',
      estimatedValue: 150000,
      score: 95
    })
  });
  assert(createPartnerA.ok && createPartnerA.data?.contact?.id, 'User A created Partner Contact successfully');
  const partnerAId = createPartnerA.data?.contact?.id;

  // Verify list & type filtering
  const listAllA = await request('/api/crm/contacts', { headers: authHeadersA });
  assert(listAllA.ok && listAllA.data?.contacts?.length >= 2, `User A sees both contacts (${listAllA.data?.contacts?.length} total)`);

  const listPartnersA = await request('/api/crm/contacts?type=PARTNER', { headers: authHeadersA });
  assert(
    listPartnersA.ok &&
    listPartnersA.data?.contacts?.every(c => c.type === 'PARTNER') &&
    listPartnersA.data?.contacts?.some(c => c.id === partnerAId),
    'type=PARTNER filter returns only partner records'
  );

  const listLeadsA = await request('/api/crm/contacts?type=LEAD', { headers: authHeadersA });
  assert(
    listLeadsA.ok &&
    listLeadsA.data?.contacts?.every(c => c.type === 'LEAD') &&
    listLeadsA.data?.contacts?.some(c => c.id === contactAId),
    'type=LEAD filter returns only lead records'
  );

  // --- Test 4: Sales Pipeline Deal CRUD & Stage Advancement ---
  console.log('\n--- Test 4: Sales Pipeline Deals & Stage Transitions ---');
  const createDealA = await request('/api/crm/deals', {
    method: 'POST',
    headers: authHeadersA,
    body: JSON.stringify({
      title: 'Apex Cloud Migration',
      value: 65000,
      currency: 'USD',
      contactId: contactAId,
      stage: 'DISCOVERY',
      probability: 25,
      expectedCloseDate: '2026-12-31',
      notes: 'Initial discovery call scheduled.'
    })
  });
  assert(createDealA.ok && createDealA.data?.deal?.id, 'User A created Deal successfully');
  const dealAId = createDealA.data?.deal?.id;
  assert(createDealA.data?.deal?.contactName === 'David Sterling', 'Deal correctly linked to Contact Name');

  // Advance stage to PROPOSAL (STAGE_PROBABILITIES is 75)
  const updateStageProposal = await request(`/api/crm/deals/${dealAId}/stage`, {
    method: 'PATCH',
    headers: authHeadersA,
    body: JSON.stringify({ stage: 'PROPOSAL' })
  });
  assert(
    updateStageProposal.ok &&
    updateStageProposal.data?.deal?.stage === 'PROPOSAL' &&
    updateStageProposal.data?.deal?.probability === 75,
    'Deal stage updated to PROPOSAL with auto-calculated 75% probability'
  );

  // Advance stage to WON (STAGE_PROBABILITIES is 100)
  const updateStageWon = await request(`/api/crm/deals/${dealAId}/stage`, {
    method: 'PATCH',
    headers: authHeadersA,
    body: JSON.stringify({ stage: 'WON' })
  });
  assert(
    updateStageWon.ok &&
    updateStageWon.data?.deal?.stage === 'WON' &&
    updateStageWon.data?.deal?.probability === 100,
    'Deal stage updated to WON with auto-calculated 100% probability'
  );

  // --- Test 5: Dynamic Database Metrics Calculation ---
  console.log('\n--- Test 5: Real Database CRM Metrics ---');
  const metricsA = await request('/api/crm/metrics', { headers: authHeadersA });
  assert(metricsA.ok && metricsA.data?.metrics, 'User A metrics returned successfully');
  const m = metricsA.data?.metrics;
  console.log(`    User A Metrics: Total Pipeline=$${m?.totalPipelineValue}, Deals=${m?.activeDealsCount}, Won=${m?.wonDealsCount}, Contacts=${m?.totalContactsCount}, Partners=${m?.totalPartnersCount}, WinRate=${m?.winRatePercentage}%`);
  assert(m?.totalContactsCount >= 1, `Metrics correctly counted non-partner contacts (${m?.totalContactsCount} >= 1)`);
  assert(m?.totalPartnersCount >= 1, `Metrics correctly counted partners (${m?.totalPartnersCount} >= 1)`);
  assert(m?.totalContactsCount + m?.totalPartnersCount >= 2, `Metrics correctly counted total directory entries (${m?.totalContactsCount + m?.totalPartnersCount} >= 2)`);
  assert(m?.wonDealsCount >= 1, `Metrics correctly counted won deals (${m?.wonDealsCount} >= 1)`);
  assert(m?.winRatePercentage > 0, `Metrics calculated non-zero win rate (${m?.winRatePercentage}%)`);

  // --- Test 6: Strict Cross-User Data Isolation ---
  console.log('\n--- Test 6: Strict Cross-User Data Isolation ---');
  const contactsB = await request('/api/crm/contacts', { headers: authHeadersB });
  assert(contactsB.ok && contactsB.data?.contacts?.length === 0, 'User B sees 0 contacts (isolated from User A)');

  const dealsB = await request('/api/crm/deals', { headers: authHeadersB });
  assert(dealsB.ok && dealsB.data?.deals?.length === 0, 'User B sees 0 deals (isolated from User A)');

  const metricsB = await request('/api/crm/metrics', { headers: authHeadersB });
  assert(metricsB.ok && metricsB.data?.metrics?.totalContactsCount === 0 && metricsB.data?.metrics?.activeDealsCount === 0, 'User B metrics are completely isolated (0 contacts, 0 deals)');

  // User B attempts to access User A's contact directly
  const directContactAttempt = await request(`/api/crm/contacts/${contactAId}`, { headers: authHeadersB });
  assert(directContactAttempt.status === 404, 'User B cannot access User A contact by ID (returns 404)');

  // User B attempts to access User A's deal directly
  const directDealAttempt = await request(`/api/crm/deals/${dealAId}`, { headers: authHeadersB });
  assert(directDealAttempt.status === 404, 'User B cannot access User A deal by ID (returns 404)');

  // User B attempts to modify User A's deal stage
  const directStageAttempt = await request(`/api/crm/deals/${dealAId}/stage`, {
    method: 'PATCH',
    headers: authHeadersB,
    body: JSON.stringify({ stage: 'LOST' })
  });
  assert(directStageAttempt.status === 404, 'User B cannot modify User A deal stage (returns 404)');

  // --- Test 7: CSV Bulk Import ---
  console.log('\n--- Test 7: CSV Bulk Import Persistence ---');
  const bulkPayload = [
    { name: 'Robert Chen', email: `robert_${timestamp}@hypergrowth.ai`, company: 'HyperGrowth', role: 'Head of Growth', type: 'LEAD', dealValue: 18000 },
    { name: 'Alice Morgan', email: `alice_${timestamp}@nexuscloud.io`, company: 'Nexus Cloud', role: 'CTO', type: 'LEAD', dealValue: 32000 },
    { name: 'Global Tech', email: `partners_${timestamp}@globaltech.com`, company: 'Global Tech', role: 'Alliance Director', type: 'PARTNER', dealValue: 120000 }
  ];
  const bulkRes = await request('/api/crm/contacts/bulk-import', {
    method: 'POST',
    headers: authHeadersA,
    body: JSON.stringify({ contacts: bulkPayload })
  });
  assert(bulkRes.ok && bulkRes.data?.importedCount === 3, `CSV bulk import imported ${bulkRes.data?.importedCount} contacts successfully`);

  const afterImportA = await request('/api/crm/contacts', { headers: authHeadersA });
  assert(afterImportA.ok && afterImportA.data?.contacts?.length >= 5, `User A contacts increased to ${afterImportA.data?.contacts?.length}`);

  // User B still has 0 contacts
  const contactsBAfterImport = await request('/api/crm/contacts', { headers: authHeadersB });
  assert(contactsBAfterImport.ok && contactsBAfterImport.data?.contacts?.length === 0, 'User B still has 0 contacts after User A bulk import');

  // --- Test 8: Internal CRM AI Bridge Integration ---
  console.log('\n--- Test 8: Internal CRM AI Data Source Verification ---');
  try {
    const { CrmLiveDataService } = await import('../ai/crm-live/crmLiveDataService.js');
    const userContext = {
      userId: userA.id,
      tenantId: 'global',
      crmDataSource: 'INTERNAL'
    };
    const summary = await CrmLiveDataService.getDealPipelineSummary(userContext);
    assert(summary.dataSource === 'INTERNAL_CRM', 'AI bridge returns dataSource: INTERNAL_CRM');
    assert(summary.totalPipelineDeals >= 1, `AI bridge retrieved ${summary.totalPipelineDeals} internal deals`);

    const pipeValue = await CrmLiveDataService.getPipelineValue(userContext);
    assert(pipeValue.dataSource === 'INTERNAL_CRM', 'Pipeline value returns dataSource: INTERNAL_CRM');
    assert(pipeValue.dealPipelineValue > 0, `Pipeline value calculated internal value: $${pipeValue.dealPipelineValue}`);
  } catch (err) {
    console.error('AI Bridge test error:', err.message);
    failed++;
  }

  // --- Summary ---
  console.log('\n====================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
