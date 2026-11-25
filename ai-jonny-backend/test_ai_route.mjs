async function run() {
  const t1 = Date.now();
  try {
    const d1 = await fetch('http://127.0.0.1:5000/api/integration/crm-nergy').then(r => r.json());
    console.log('127.0.0.1 took:', Date.now() - t1, 'ms, success:', d1.success);
  } catch (e) {
    console.log('127.0.0.1 err:', e.message);
  }

  const t2 = Date.now();
  try {
    const d2 = await fetch('http://localhost:5000/api/integration/crm-nergy').then(r => r.json());
    console.log('localhost took:', Date.now() - t2, 'ms, success:', d2.success);
  } catch (e) {
    console.log('localhost err:', e.message);
  }
}
run();
