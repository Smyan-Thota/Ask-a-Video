document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveKey');
  const statusDiv = document.getElementById('status');

  function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  saveButton.addEventListener('click', function() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
      showStatus('Please enter an API key.', 'error');
      return;
    }
    
    if (!key.startsWith('sk-')) {
      showStatus('API key should start with "sk-". Please check your key.', 'error');
      return;
    }
    
    chrome.storage.local.set({ apiKey: key }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Error saving API key: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('API Key saved successfully!', 'success');
        apiKeyInput.value = '';
      }
    });
  });

  // Load existing API key on page load (masked for security)
  chrome.storage.local.get('apiKey', function(result) {
    if (result.apiKey) {
      // Show masked version for confirmation
      const maskedKey = result.apiKey.substring(0, 7) + '...' + result.apiKey.substring(result.apiKey.length - 4);
      apiKeyInput.placeholder = `Current key: ${maskedKey}`;
    }
  });

  // Allow Enter key to save
  apiKeyInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });
});