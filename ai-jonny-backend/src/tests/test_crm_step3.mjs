/**
 * CRM nErgy Step 3 Verification Suite
 * Tests:
 * 1. Unauthenticated rejection (401) on new endpoints
 * 2. User registration and auth token validation
 * 3. Communication History: CALL, EMAIL, MEETING, NOTE logging with contact/deal links
 * 4. Filtering activities by type, contact, and deal
 * 5. Automated deal stage logging and DUPLICATE prevention
 * 6. Won Deal Conversion to Project with duplicate conversion prevention
 * 7. Projects & Tasks CRUD, progress tracking, and status toggles
 * 8. Strict cross-user data isolation (User B cannot see or manipulate User A data)
 * 9. Safe deletion of activities, tasks, and projects
 * 10. Step 2 CRM regression verification
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
  console.log('CRM nErgy Step 3 - Targeted Verification Suite');
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

  // --- Test 1: Unauthenticated Protection ---
  console.log('--- Test 1: Unauthenticated Protection for Step 3 Endpoints ---');
  const unauthActs = await request('/api/crm/activities');
  assert(unauthActs.status === 401, 'Unauthenticated /api/crm/activities returns 401');

  const unauthProjs = await request('/api/crm/projects');
  assert(unauthProjs.status === 401, 'Unauthenticated /api/crm/projects returns 401');

  const unauthTasks = await request('/api/crm/tasks');
  assert(unauthTasks.status === 401, 'Unauthenticated /api/crm/tasks returns 401');

  const unauthConvert = await request('/api/crm/deals/fake_deal/convert-to-project', { method: 'POST' });
  assert(unauthConvert.status === 401, 'Unauthenticated convert-to-project returns 401');

  // --- Test 2: User Setup ---
  console.log('\n--- Test 2: User Registration & Authentication ---');
  const timestamp = Date.now();
  const userAEmail = `crm_step3_a_${timestamp}@example.com`;
  const userBEmail = `crm_step3_b_${timestamp}@example.com`;
  const password = 'Step3Password123!';

  const regA = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Step3 User A', email: userAEmail, password })
  });
  assert(regA.ok && regA.data.token, `User A registered (${userAEmail})`);
  const tokenA = regA.data.token;
  const userA = regA.data.user;

  const regB = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Step3 User B', email: userBEmail, password })
  });
  assert(regB.ok && regB.data.token, `User B registered (${userBEmail})`);
  const tokenB = regB.data.token;
  const userB = regB.data.user;

  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  // Setup Contact and Deal for User A
  const createContact = await request('/api/crm/contacts', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      firstName: 'Marcus',
      lastName: 'Brody',
      email: `marcus_${timestamp}@acmeenterprises.com`,
      company: 'Acme Enterprises',
      type: 'LEAD',
      status: 'QUALIFIED'
    })
  });
  assert(createContact.ok && createContact.data?.contact?.id, 'User A created Contact');
  const contactId = createContact.data?.contact?.id;

  const createDeal = await request('/api/crm/deals', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'Acme Enterprise License',
      value: 85000,
      currency: 'USD',
      contactId: contactId,
      stage: 'QUALIFIED',
      expectedCloseDate: '2026-12-15'
    })
  });
  assert(createDeal.ok && createDeal.data?.deal?.id, 'User A created Deal');
  const dealId = createDeal.data?.deal?.id;

  // --- Test 3: Communication History Activities Logging ---
  console.log('\n--- Test 3: Communication History Activities CRUD ---');
  // 1. Log Phone Call
  const logCall = await request('/api/crm/activities', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      contactId,
      dealId,
      activityType: 'CALL',
      title: 'Discovery Phone Call with Marcus Brody',
      description: 'Discussed cloud migration timelines and budget constraints. Positive outlook.'
    })
  });
  assert(logCall.ok && logCall.data?.activity?.id, 'Logged CALL activity successfully');
  const callActivityId = logCall.data?.activity?.id;
  assert(logCall.data?.activity?.contactName === 'Marcus Brody', 'Activity correctly resolved contactName');
  assert(logCall.data?.activity?.dealTitle === 'Acme Enterprise License', 'Activity correctly resolved dealTitle');

  // 2. Log Email
  const logEmail = await request('/api/crm/activities', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      contactId,
      dealId,
      activityType: 'EMAIL',
      title: 'Sent Proposal & Security Whitepaper',
      description: 'Transmitted SOC2 compliance overview and pricing tier spreadsheet.'
    })
  });
  assert(logEmail.ok && logEmail.data?.activity?.activityType === 'EMAIL', 'Logged EMAIL activity successfully');

  // 3. Log Meeting
  const logMeeting = await request('/api/crm/activities', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      contactId,
      activityType: 'MEETING',
      title: 'Technical Deep-Dive Architecture Review',
      description: 'Reviewed API integration specs with engineering leads.'
    })
  });
  assert(logMeeting.ok && logMeeting.data?.activity?.activityType === 'MEETING', 'Logged MEETING activity successfully');

  // 4. Log Note
  const logNote = await request('/api/crm/activities', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      activityType: 'NOTE',
      title: 'Account Internal Planning Note',
      description: 'Potential for Q1 multi-year renewal expansion.'
    })
  });
  assert(logNote.ok && logNote.data?.activity?.activityType === 'NOTE', 'Logged NOTE activity successfully');

  // --- Test 4: Activities Filtering ---
  console.log('\n--- Test 4: Activities Filtering & Chronology ---');
  const allActs = await request('/api/crm/activities', { headers: headersA });
  assert(allActs.ok && allActs.data?.activities?.length >= 4, `User A retrieved all activities (${allActs.data?.activities?.length} total)`);

  const callActs = await request('/api/crm/activities?activityType=CALL', { headers: headersA });
  assert(
    callActs.ok &&
    callActs.data?.activities?.every(a => a.activityType === 'CALL'),
    'activityType=CALL filter returns only call records'
  );

  const contactActs = await request(`/api/crm/activities?contactId=${contactId}`, { headers: headersA });
  assert(
    contactActs.ok &&
    contactActs.data?.activities?.every(a => a.contactId === contactId),
    'contactId filter returns only contact-associated activities'
  );

  // --- Test 5: Automated Stage Change Logging & Duplicate Prevention ---
  console.log('\n--- Test 5: Automated Deal Stage Logging & Duplicate Prevention ---');
  const initialStageActs = await request(`/api/crm/activities?dealId=${dealId}&activityType=STAGE_CHANGE`, { headers: headersA });
  const initialCount = initialStageActs.data?.activities?.length || 0;

  // Advance deal to PROPOSAL
  const adv1 = await request(`/api/crm/deals/${dealId}/stage`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ stage: 'PROPOSAL' })
  });
  assert(adv1.ok && adv1.data?.deal?.stage === 'PROPOSAL', 'Deal advanced to PROPOSAL');

  const afterAdv1 = await request(`/api/crm/activities?dealId=${dealId}&activityType=STAGE_CHANGE`, { headers: headersA });
  assert(afterAdv1.data?.activities?.length === initialCount + 1, 'Stage change activity logged automatically');

  // Attempt duplicate stage change to PROPOSAL again
  const advDup = await request(`/api/crm/deals/${dealId}/stage`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ stage: 'PROPOSAL' })
  });
  assert(advDup.ok && advDup.data?.deal?.stage === 'PROPOSAL', 'Duplicate stage request succeeded gracefully');

  const afterDup = await request(`/api/crm/activities?dealId=${dealId}&activityType=STAGE_CHANGE`, { headers: headersA });
  assert(afterDup.data?.activities?.length === initialCount + 1, 'Duplicate stage transition DID NOT create redundant activity log');

  // Advance to WON
  const advWon = await request(`/api/crm/deals/${dealId}/stage`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ stage: 'WON' })
  });
  assert(advWon.ok && advWon.data?.deal?.stage === 'WON', 'Deal advanced to WON');

  // --- Test 6: Won Deal Conversion to Project & Duplicate Prevention ---
  console.log('\n--- Test 6: Won Deal Conversion into Delivery Project ---');
  const convertRes = await request(`/api/crm/deals/${dealId}/convert-to-project`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      projectName: 'Acme Cloud Implementation & Delivery',
      category: 'Client Project',
      dueDate: '2026-12-31'
    })
  });
  assert(convertRes.ok && convertRes.data?.project?.id, 'Won deal converted into project successfully');
  const convertedProjId = convertRes.data?.project?.id;
  assert(convertRes.data?.project?.dealId === dealId, 'Converted project linked to source deal');
  assert(convertRes.data?.project?.tasks?.length >= 1, 'Converted project created initial kickoff task');

  // Duplicate conversion prevention
  const dupConvert = await request(`/api/crm/deals/${dealId}/convert-to-project`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ projectName: 'Acme Cloud Implementation - Duplicate' })
  });
  assert(
    dupConvert.status === 400 || dupConvert.status === 409 || !dupConvert.ok,
    'Duplicate deal conversion correctly prevented with error response'
  );

  // --- Test 7: Projects & Tasks CRUD ---
  console.log('\n--- Test 7: Direct Project & Task Management CRUD ---');
  // Create direct project
  const createProj = await request('/api/crm/projects', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'Global Brand Refresh 2026',
      category: 'Brand Rebrand',
      status: 'IN_PROGRESS',
      progress: 25,
      dueDate: '2026-11-30',
      description: 'Omnichannel visual identity refresh across all web properties.'
    })
  });
  assert(createProj.ok && createProj.data?.project?.id, 'Created direct project successfully');
  const directProjId = createProj.data?.project?.id;

  // Create tasks for this project
  const task1 = await request('/api/crm/tasks', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      relatedType: 'PROJECT',
      relatedId: directProjId,
      title: 'Design Logo Guidelines and Palette System',
      priority: 'HIGH',
      status: 'PENDING'
    })
  });
  assert(task1.ok && task1.data?.task?.id, 'Created Task 1 (HIGH priority) for project');
  const task1Id = task1.data?.task?.id;

  const task2 = await request('/api/crm/tasks', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      relatedType: 'PROJECT',
      relatedId: directProjId,
      title: 'Typography Licensing & Web Font Pairing',
      priority: 'MEDIUM',
      status: 'PENDING'
    })
  });
  assert(task2.ok && task2.data?.task?.id, 'Created Task 2 for project');
  const task2Id = task2.data?.task?.id;

  // Update Task 1 status to COMPLETED
  const updateTask1 = await request(`/api/crm/tasks/${task1Id}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  assert(updateTask1.ok && updateTask1.data?.task?.status === 'COMPLETED', 'Updated Task 1 status to COMPLETED');

  // Update Project progress
  const updateProj = await request(`/api/crm/projects/${directProjId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ progress: 50, status: 'IN_PROGRESS' })
  });
  assert(updateProj.ok && updateProj.data?.project?.progress === 50, 'Updated Project progress to 50%');

  // Verify project list with tasks counts
  const projsList = await request('/api/crm/projects', { headers: headersA });
  assert(projsList.ok && projsList.data?.projects?.length >= 2, `User A retrieved ${projsList.data?.projects?.length} projects`);
  const foundDirect = projsList.data?.projects?.find(p => p.id === directProjId);
  assert(foundDirect && foundDirect.tasksCount === 2, `Project accurately calculated tasksCount (2 tasks)`);
  assert(foundDirect && foundDirect.completedTasksCount === 1, `Project accurately calculated completedTasksCount (1 completed)`);

  // --- Test 8: Cross-User Data Isolation ---
  console.log('\n--- Test 8: Strict Cross-User Data Isolation ---');
  const actsB = await request('/api/crm/activities', { headers: headersB });
  assert(actsB.ok && actsB.data?.activities?.length === 0, 'User B sees 0 activities (isolated from User A)');

  const projsB = await request('/api/crm/projects', { headers: headersB });
  assert(projsB.ok && projsB.data?.projects?.length === 0, 'User B sees 0 projects (isolated from User A)');

  const tasksB = await request('/api/crm/tasks', { headers: headersB });
  assert(tasksB.ok && tasksB.data?.tasks?.length === 0, 'User B sees 0 tasks (isolated from User A)');

  // User B direct access attempts
  const directProjAtt = await request(`/api/crm/projects/${directProjId}`, { headers: headersB });
  assert(directProjAtt.status === 404, 'User B cannot access User A project by ID (returns 404)');

  const directTaskAtt = await request(`/api/crm/tasks/${task1Id}`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ status: 'PENDING' })
  });
  assert(directTaskAtt.status === 404, 'User B cannot update User A task (returns 404)');

  const directConvertAtt = await request(`/api/crm/deals/${dealId}/convert-to-project`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ projectName: 'Hacked Project' })
  });
  assert(directConvertAtt.status === 404, 'User B cannot convert User A deal (returns 404)');

  // --- Test 9: Deletion & Cleanup ---
  console.log('\n--- Test 9: Deletion Operations ---');
  const delTask = await request(`/api/crm/tasks/${task2Id}`, { method: 'DELETE', headers: headersA });
  assert(delTask.ok && delTask.data?.success, 'Task 2 deleted successfully');

  const delAct = await request(`/api/crm/activities/${callActivityId}`, { method: 'DELETE', headers: headersA });
  assert(delAct.ok && delAct.data?.success, 'CALL activity deleted successfully');

  const delProj = await request(`/api/crm/projects/${directProjId}`, { method: 'DELETE', headers: headersA });
  assert(delProj.ok && delProj.data?.success, 'Direct project deleted successfully');

  // Verify deleted project tasks are cascadingly cleaned up
  const tasksAfterProjDel = await request(`/api/crm/tasks?relatedId=${directProjId}`, { headers: headersA });
  assert(tasksAfterProjDel.ok && tasksAfterProjDel.data?.tasks?.length === 0, 'Tasks linked to deleted project were cleaned up');

  // --- Test 10: Step 2 CRM Regression Verification ---
  console.log('\n--- Test 10: Step 2 CRM Regression Check ---');
  const metricsA = await request('/api/crm/metrics', { headers: headersA });
  assert(metricsA.ok && metricsA.data?.metrics?.wonDealsCount >= 1, 'Metrics correctly reflect won deals');
  assert(metricsA.data?.metrics?.totalContactsCount >= 1, 'Metrics correctly reflect contacts count');

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
