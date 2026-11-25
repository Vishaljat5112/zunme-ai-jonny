/**
 * Comprehensive Automated Verification Suite for:
 * 1. AI Provider availability (Ollama, models list, fallback routing)
 * 2. Real Ollama inference (non-streaming and SSE streaming)
 * 3. Conversation & message persistence in MySQL
 * 4. Cross-user isolation (unauthorized conversation / message access)
 * 5. Secure file upload (CSV, tabular, office validation)
 * 6. Authenticated file access control (owner vs other user vs unauthenticated)
 * 7. Library persistence & cross-user protection (OFFICE and CHART content types)
 * 8. Reusable Office & EgoLytics Charts services
 */

import { AuthService } from '../services/authService.js';
import { OfficeChartsService } from '../services/officeChartsService.js';
import { getPool } from '../db/pool.js';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  const results = [];
  const logTest = (name, pass, details = '') => {
    results.push({ name, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${details ? ' - ' + details : ''}`);
  };

  const userA = { id: 'usr_creator', email: 'alex.creator@zunme.ai', role: 'USER' };
  const userB = { id: 'usr_business', email: 'business@zunme.ai', role: 'USER' };
  const tokenA = AuthService.generateToken(userA);
  const tokenB = AuthService.generateToken(userB);

  const convId = 'conv_foundation_' + Date.now();

  try {
    // 1. Health & AI Provider Status
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    logTest('1. System Health Check', healthRes.status === 200 && healthData.database?.connected === true, `status: ${healthData.status}`);

    const modelsRes = await fetch(`${BASE_URL}/models`);
    const modelsData = await modelsRes.json();
    const hasOllamaModels = modelsData.models && modelsData.models.length > 0;
    logTest('2. AI Provider Models Listing', modelsRes.status === 200 && hasOllamaModels, `provider: ${modelsData.provider}, count: ${modelsData.models?.length}`);

    // 3. Real Ollama Non-Streaming Inference
    const msgRes = await fetch(`${BASE_URL}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        content: 'Say the word "Zunme" and nothing else.',
        model: 'smollm2:135m',
        stream: false
      })
    });
    const msgData = await msgRes.json();
    const assistantContent = msgData.assistantMessage?.content || '';
    logTest('3. Real Ollama Non-Streaming Inference', msgRes.status === 201 && assistantContent.length > 0, `response snippet: "${assistantContent.trim().slice(0, 40)}"`);

    // 4. Conversation & Message Persistence in MySQL
    const pool = getPool();
    const [convRows] = await pool.query('SELECT * FROM conversations WHERE id = ?', [convId]);
    const [msgRows] = await pool.query('SELECT * FROM messages WHERE conversation_id = ?', [convId]);
    logTest('4. Conversation & Message MySQL Persistence', convRows.length === 1 && msgRows.length >= 2, `convs: ${convRows.length}, msgs: ${msgRows.length}`);

    // 5. Real Ollama SSE Streaming Inference
    const streamRes = await fetch(`${BASE_URL}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        content: 'Count from 1 to 3.',
        model: 'smollm2:135m',
        stream: true
      })
    });
    const isSSE = streamRes.headers.get('content-type')?.includes('text/event-stream');
    let chunkCount = 0;
    if (isSSE && streamRes.body) {
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        if (text.includes('event: chunk')) chunkCount++;
      }
    }
    logTest('5. Real Ollama SSE Streaming', streamRes.status === 200 && isSSE && chunkCount > 0, `chunks received: ${chunkCount}`);

    // 6. Cross-User Protection on Messages
    const userBMsgFetch = await fetch(`${BASE_URL}/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    logTest('6. Cross-User Conversation Protection', userBMsgFetch.status === 404, `User B status: ${userBMsgFetch.status}`);

    // 7. Secure File Upload (Office/CSV)
    const fileBlob = new Blob(['Metric,Q1,Q2\nRevenue,100,150\nProfit,30,50'], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('conversationId', convId);
    formData.append('files', fileBlob, 'chart_q1_q2.csv');

    const uploadRes = await fetch(`${BASE_URL}/attachments/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    const attId = uploadData.attachments?.[0]?.id;
    logTest('7. Secure Tabular / Office File Upload', uploadRes.status === 201 && Boolean(attId), `attachmentId: ${attId}`);

    // 8. Authenticated File Download (Owner Access)
    const ownerFileRes = await fetch(`${BASE_URL}/attachments/${attId}/file`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    logTest('8. Owner File Download Access', ownerFileRes.status === 200, `status: ${ownerFileRes.status}`);

    // 9. Unauthorized File Download Access (Cross-User Blocked)
    const otherFileRes = await fetch(`${BASE_URL}/attachments/${attId}/file`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    logTest('9. Cross-User File Access Blocked', otherFileRes.status === 404, `status: ${otherFileRes.status}`);

    // 10. Unauthenticated File Download Access (Guest Blocked)
    const guestFileRes = await fetch(`${BASE_URL}/attachments/${attId}/file`);
    logTest('10. Unauthenticated File Access Blocked', guestFileRes.status === 401, `status: ${guestFileRes.status}`);

    // 11. Forbidden Executable File Upload Blocked
    const exeBlob = new Blob(['echo dangerous'], { type: 'application/x-msdownload' });
    const exeForm = new FormData();
    exeForm.append('conversationId', convId);
    exeForm.append('files', exeBlob, 'malicious.exe');
    const exeRes = await fetch(`${BASE_URL}/attachments/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: exeForm
    });
    logTest('11. Forbidden Executable (.exe) Upload Blocked', exeRes.status >= 400 && exeRes.status !== 201, `status: ${exeRes.status}`);

    // 12. Library Persistence for Office & Charts
    const libOfficeRes = await fetch(`${BASE_URL}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'Q4 Financial Memorandum',
        contentType: 'OFFICE',
        content: '# Q4 Executive Review\n\nRevenue grew by 24% YoY.'
      })
    });
    const libOfficeData = await libOfficeRes.json();

    const libChartRes = await fetch(`${BASE_URL}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'EgoLytics MRR Growth XY Chart',
        contentType: 'CHART',
        content: JSON.stringify({ chartType: 'bar', series: [10, 20, 30] })
      })
    });
    const libChartData = await libChartRes.json();
    logTest('12. Library OFFICE & CHART Persistence', libOfficeRes.status === 201 && libChartRes.status === 201, `office: ${libOfficeData.item?.id}, chart: ${libChartData.item?.id}`);

    // 13. Library Cross-User Isolation
    const otherLibRes = await fetch(`${BASE_URL}/library/${libOfficeData.item?.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    logTest('13. Library Cross-User Isolation Blocked', otherLibRes.status === 404, `status: ${otherLibRes.status}`);

    // 14. Library Unauthenticated Access Blocked
    const guestLibRes = await fetch(`${BASE_URL}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Guest Item', content: 'Secret' })
    });
    logTest('14. Library Unauthenticated Mutation Blocked', guestLibRes.status === 401, `status: ${guestLibRes.status}`);

    // 15. Reusable Office & Charts Foundation Service
    const tabularValidation = OfficeChartsService.validateTabularData('Day,Visitors\nMon,120\nTue,145');
    const chartPrompt = OfficeChartsService.buildChartSystemPrompt();
    const officePrompt = OfficeChartsService.buildOfficeSystemPrompt('spreadsheet');
    const foundationValid = tabularValidation.valid && chartPrompt.includes('EgoLytics') && officePrompt.includes('Spreadsheet');
    logTest('15. Reusable Office & Charts Foundation Service', foundationValid, `rows: ${tabularValidation.rowCount}`);

    // Cleanup test records
    await pool.query('DELETE FROM attachments WHERE conversation_id = ?', [convId]);
    await pool.query('DELETE FROM messages WHERE conversation_id = ?', [convId]);
    await pool.query('DELETE FROM conversations WHERE id = ?', [convId]);
    await pool.query('DELETE FROM library_items WHERE user_id IN (?, ?)', [userA.id, userB.id]);
    console.log('\nAll test artifacts cleaned up cleanly.');

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`\n================================`);
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`================================\n`);
  } catch (err) {
    console.error('Fatal test runner error:', err);
  }
}

runTests();
