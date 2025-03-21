document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on Claude.ai
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isOnClaude = tabs[0].url && tabs[0].url.includes('claude.ai');
    
    if (!isOnClaude) {
      updateStatus('Please navigate to a Claude.ai chat page to use this extension.');
    } else {
      updateStatus('Ready to export your Claude chat.');
    }
  });

  document.getElementById('exportMarkdown').addEventListener('click', () => {
    exportChat('markdown');
  });

  document.getElementById('exportJSON').addEventListener('click', () => {
    exportChat('json');
  });

  document.getElementById('debugPage').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      updateStatus('Analyzing page structure...');
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'debugPage' },
        function(response) {
          if (chrome.runtime.lastError) {
            updateStatus('Error: ' + chrome.runtime.lastError.message);
            return;
          }
          
          if (response && response.pageInfo) {
            // Create and download debug info
            const debugData = JSON.stringify(response.pageInfo, null, 2);
            const blob = new Blob([debugData], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
              url: url,
              filename: 'claude-page-debug.json',
              saveAs: true
            }, function() {
              updateStatus('Debug info exported');
              URL.revokeObjectURL(url);
            });
          } else {
            updateStatus('Failed to get debug info');
          }
        }
      );
    });
  });

  function exportChat(format) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0].url.includes('claude.ai/chat')) {
        updateStatus('Please navigate to a Claude.ai chat page');
        return;
      }
      
      updateStatus('Exporting chat...');
      console.log('Sending message to tab:', tabs[0].id);
      
      try {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'exportChat', format: format },
          function(response) {
            console.log('Response received:', response);
            if (chrome.runtime.lastError) {
              updateStatus('Error: ' + chrome.runtime.lastError.message);
              console.error('Runtime error:', chrome.runtime.lastError);
              return;
            }
            
            if (!response || !response.success) {
              updateStatus('Failed to extract chat data');
              return;
            }
            
            // Create file
            const filename = `claude-chat-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format === 'json' ? 'json' : 'md'}`;
            const blob = new Blob([response.data], {type: format === 'json' ? 'application/json' : 'text/markdown'});
            const url = URL.createObjectURL(blob);
            
            // Download file
            chrome.downloads.download({
              url: url,
              filename: filename,
              saveAs: true
            }, function() {
              if (chrome.runtime.lastError) {
                updateStatus('Error saving file: ' + chrome.runtime.lastError.message);
              } else {
                updateStatus('Chat exported successfully!');
              }
              URL.revokeObjectURL(url);
            });
          });
        }
      catch (error) {
        console.error('Error sending message:', error);
        updateStatus('Error connecting to the page. Try refreshing the page and reopening the extension.');
      }
    });
  }

  function updateStatus(message) {
    document.getElementById('status').textContent = message;
  }
});