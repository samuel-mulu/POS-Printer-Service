document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('service-status');
  const printerValue = document.getElementById('printer-connected');
  const queueValue = document.getElementById('queue-length');
  const keyInput = document.getElementById('print-key');
  const receiptInput = document.getElementById('receipt-text');
  const testBtn = document.getElementById('test-print');
  const sendBtn = document.getElementById('send-print');
  const logArea = document.getElementById('log');

  // Load key from localStorage
  const savedKey = localStorage.getItem('pos_print_key');
  if (savedKey) keyInput.value = savedKey;

  keyInput.addEventListener('change', () => {
    localStorage.setItem('pos_print_key', keyInput.value);
  });

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    logArea.innerText = `[${timestamp}] ${prefix}${msg}\n` + logArea.innerText;
  };

  const updateStatus = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        statusBadge.innerText = 'Online';
        statusBadge.className = 'status-badge status-online';
        printerValue.innerText = data.printerConnected ? 'Connected' : 'Disconnected';
        printerValue.className = data.printerConnected ? 'info-value status-online' : 'info-value status-offline';
        queueValue.innerText = `${data.queue.length} (${data.queue.processing ? 'processing' : 'idle'})`;
      } else {
        throw new Error('Health check failed');
      }
    } catch (err) {
      statusBadge.innerText = 'Error';
      statusBadge.className = 'status-badge status-offline';
      printerValue.innerText = '-';
      queueValue.innerText = '-';
    }
  };

  const sendPrint = async (data) => {
    const key = keyInput.value;
    if (!key) {
      addLog('Print key is required', 'error');
      return;
    }

    sendBtn.disabled = true;
    testBtn.disabled = true;
    addLog('Sending print job...');

    try {
      const res = await fetch('/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Print-Key': key
        },
        body: JSON.stringify({ data })
      });

      const result = await res.json();
      if (res.ok) {
        addLog('Print job sent successfully', 'success');
      } else {
        addLog(`Print failed: ${result.error || result.message}`, 'error');
      }
    } catch (err) {
      addLog(`Network error: ${err.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
      testBtn.disabled = false;
      updateStatus();
    }
  };

  testBtn.addEventListener('click', () => {
    const testData = `================================================
           3T JUICE
================================================

TEST RECEIPT
Date: ${new Date().toLocaleString()}

This is a test print from the 
POS Printer Companion UI.

================================================
    Thank you for testing!
================================================`;
    sendPrint(testData);
  });

  sendBtn.addEventListener('click', () => {
    const data = receiptInput.value;
    if (!data || data.trim().length === 0) {
      addLog('Receipt text is empty', 'error');
      return;
    }
    sendPrint(data);
  });

  // Start polling
  updateStatus();
  setInterval(updateStatus, 5000);
});
