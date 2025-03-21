// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Claude.ai Chat Exporter extension installed');
  });
  
  // Listen for tab updates to reload content script if needed
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('claude.ai/chat')) {
      console.log('Claude.ai page loaded, ensuring content script is active');
      
      // Attempt to check if content script is running
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          // Content script is not available, inject it
          console.log('Content script not detected, injecting it');
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
        }
      });
    }
  });
  
  // Handle messages from popup or content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    
    if (request.action === 'getStatus') {
      sendResponse({ status: 'Background script is running' });
    }
    
    return true; // For async response
  });