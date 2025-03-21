// Initialize connection on page load
console.log("Claude.ai Chat Exporter content script loaded");

// Function to analyze page structure for debugging
function analyzePageStructure() {
  const info = {
    url: window.location.href,
    title: document.title,
    selectors: {}
  };
  
  // Test common selectors
  const selectorsToTest = [
    'h1', 
    'time', 
    '[data-message-id]',
    '[data-testid="message-author"]',
    '[data-message-content-container="true"]',
    '.message',
    '.message-container',
    '[role="listitem"]',
    '.human-avatar',
    '.assistant-avatar',
    '.message-content',
    '[role="log"]',
    '[role="region"]',
    'div[class*="chat"]',
    'div[class*="message"]',
    'div[class*="claude"]',
    'div[class*="font-claude"]',
    'div[class*="font-human"]'
  ];
  
  selectorsToTest.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    info.selectors[selector] = elements.length;
  });
  
  return info;
}

// Safe check if a string is included in a className (handles both string and DOMTokenList)
function hasClass(element, className) {
  if (!element || !className) return false;
  
  // If className is a string
  if (typeof element.className === 'string') {
    return element.className.includes(className);
  }
  // If className is a DOMTokenList (classList)
  else if (element.classList && element.classList.contains) {
    return element.classList.contains(className);
  }
  
  return false;
}

// Get className as string safely
function getClassNameString(element) {
  if (!element) return '';
  
  if (typeof element.className === 'string') {
    return element.className;
  } else if (element.classList) {
    return Array.from(element.classList).join(' ');
  }
  
  return '';
}

// Function to find all conversation turns (both human and Claude messages)
function findAllConversationTurns() {
  // Look for alternating message patterns
  
  // Strategy 1: Look for font-claude-message vs font-human-message classes
  const claudeMessages = document.querySelectorAll('div[class*="font-claude"]');
  const humanMessages = document.querySelectorAll('div[class*="font-human"]');
  
  console.log(`Found ${claudeMessages.length} Claude message divs and ${humanMessages.length} human message divs`);
  
  if (claudeMessages.length > 0) {
    // If we found Claude messages, try to find their containing parent
    // which might include both human and Claude messages
    let commonParent = null;
    if (claudeMessages.length > 0) {
      let parent = claudeMessages[0].parentElement;
      for (let i = 0; i < 5 && parent; i++) { // Try up to 5 levels up
        if (parent.querySelectorAll('div[class*="font-claude"]').length === claudeMessages.length) {
          // This parent contains all Claude messages
          commonParent = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }
    
    // If we found a common parent, look for all children that might be message turns
    if (commonParent) {
      console.log("Found common parent for all messages:", commonParent);
      
      // Get all direct children that might be message containers
      const possibleMessageContainers = Array.from(commonParent.children).filter(el => {
        // Skip very small elements or obvious UI elements
        if (el.textContent.trim().length < 10) return false;
        
        // Look for messages with good amount of text
        return el.textContent.trim().length > 30;
      });
      
      console.log(`Found ${possibleMessageContainers.length} possible message containers`);
      
      if (possibleMessageContainers.length > 0) {
        return {
          messages: possibleMessageContainers,
          source: 'common-parent'
        };
      }
    }
    
    // If no common parent found, try to interleave human and assistant messages
    if (claudeMessages.length > 0 || humanMessages.length > 0) {
      const allMessages = [];
      
      // Find all potential message elements (both human and Claude)
      let allPotentialMessages = [];
      
      // First try to find a container with both human and Claude messages
      const containers = document.querySelectorAll('div');
      for (const container of containers) {
        const claudeCount = container.querySelectorAll('div[class*="font-claude"]').length;
        const humanCount = container.querySelectorAll('div[class*="font-human"]').length;
        
        // If this container has multiple messages of both types
        if (claudeCount > 0 && humanCount > 0 && claudeCount + humanCount > 3) {
          console.log(`Found container with ${claudeCount} Claude and ${humanCount} human messages:`, container);
          
          // Get direct children that have substantial text
          const children = Array.from(container.children).filter(el => 
            el.textContent.trim().length > 20
          );
          
          if (children.length > allPotentialMessages.length) {
            allPotentialMessages = children;
          }
        }
      }
      
      // If we couldn't find a good container, try a different approach
      if (allPotentialMessages.length < 3) {
        // Combine both message types and sort by some heuristic (e.g., position in DOM)
        allPotentialMessages = [...claudeMessages, ...humanMessages].sort((a, b) => {
          // Try to sort by position in document
          const posA = a.getBoundingClientRect().top;
          const posB = b.getBoundingClientRect().top;
          return posA - posB;
        });
      }
      
      console.log(`Found ${allPotentialMessages.length} total message elements`);
      
      return {
        messages: allPotentialMessages,
        source: 'combined'
      };
    }
  }
  
  // Strategy 2: Fall back to finding conversation blocks by text patterns
  console.log("Using fallback strategy to find conversation turns");
  
  // Find all divs with substantial text
  const textDivs = Array.from(document.querySelectorAll('div')).filter(div => {
    const text = div.textContent.trim();
    return text.length > 100 && 
           !div.querySelector('button') && // Exclude obvious UI elements
           div.children.length < 20; // Avoid containers with too many children
  });
  
  console.log(`Found ${textDivs.length} divs with substantial text`);
  
  // Sort by most promising (most text)
  textDivs.sort((a, b) => b.textContent.length - a.textContent.length);
  
  return {
    messages: textDivs.slice(0, 20), // Take top 20 most promising
    source: 'text-content'
  };
}

// Process and clean up code blocks in HTML
function processCodeBlocks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find and process code blocks
  const codeBlocks = doc.querySelectorAll('pre, code, .code-block');
  codeBlocks.forEach(codeBlock => {
    let language = '';
    let code = '';
    
    // Extract language info
    if (codeBlock.querySelector('code')) {
      const codeElement = codeBlock.querySelector('code');
      const codeClassList = Array.from(codeElement.classList || []);
      const languageClass = codeClassList.find(cls => cls.startsWith('language-'));
      language = languageClass ? languageClass.replace('language-', '') : '';
      code = codeElement.textContent || '';
    } else {
      code = codeBlock.textContent || '';
    }
    
    // Create a replacement div
    const replacementDiv = doc.createElement('div');
    replacementDiv.setAttribute('data-code-block', language);
    replacementDiv.textContent = code;
    codeBlock.replaceWith(replacementDiv);
  });
  
  return doc.body.innerHTML;
}

// Remove unwanted elements from HTML content
function cleanupHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove UI elements
  const elementsToRemove = doc.querySelectorAll('button, .actions, [role="button"], svg, .feedback-buttons');
  elementsToRemove.forEach(el => el.remove());
  
  return doc.body.innerHTML;
}

// Respond to ping from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);
  
  if (request.action === 'ping') {
    console.log('Ping received, responding');
    sendResponse({status: 'content script active'});
    return true;
  }
  
  if (request.action === 'exportChat') {
    console.log("Export chat request received");
    
    try {
      // Extract data using improved techniques
      const chatData = extractChatDataImproved();
      console.log("Extracted data summary:", {
        title: chatData.title,
        timestamp: chatData.timestamp,
        messageCount: chatData.messages.length
      });
      
      if (request.format === 'json') {
        sendResponse({ success: true, data: JSON.stringify(chatData, null, 2) });
      } else { // markdown
        // Use Turndown for HTML to Markdown conversion
        // Configure Turndown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          emDelimiter: '*'
        });
        
        // Add custom rule for code blocks
        turndownService.addRule('codeBlocks', {
          filter: function(node) {
            return node.nodeName === 'DIV' && node.hasAttribute('data-code-block');
          },
          replacement: function(content, node) {
            const language = node.getAttribute('data-code-block');
            return '\n```' + language + '\n' + content + '\n```\n';
          }
        });
        
        const markdown = convertToMarkdownWithTurndown(chatData, turndownService);
        sendResponse({ success: true, data: markdown });
      }
    } catch (error) {
      console.error('Error exporting chat:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        stack: error.stack
      });
    }
    
    return true; // Required for async sendResponse
  }

  if (request.action === 'debugPage') {
    try {
      const pageInfo = analyzePageStructure();
      
      // Get a sample of the DOM
      pageInfo.domSample = document.body.innerHTML.substring(0, 50000);
      
      // Attempt to find conversation elements
      const conversationData = findAllConversationTurns();
      pageInfo.conversationInfo = {
        messageCount: conversationData.messages.length,
        source: conversationData.source
      };
      
      // Get samples of identified messages
      pageInfo.messageSamples = conversationData.messages.slice(0, 5).map(el => ({
        className: getClassNameString(el),
        textContent: el.textContent.substring(0, 200) + '...',
        childCount: el.children.length,
        isHuman: getClassNameString(el).includes('human') || !getClassNameString(el).includes('claude')
      }));
      
      // Include browser info
      pageInfo.userAgent = navigator.userAgent;
      
      sendResponse({ success: true, pageInfo });
    } catch (error) {
      console.error('Error debugging page:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

function extractChatDataImproved() {
  console.log("Starting improved chat data extraction");
  
  // Get chat title from page title
  let chatTitle = document.title.replace(' - Claude', '').trim();
  if (!chatTitle || chatTitle === 'Claude') {
    chatTitle = 'Claude Chat';
  }
  console.log("Using chat title:", chatTitle);
  
  // Current timestamp
  const timestamp = new Date().toISOString();
  
  // Find all conversation turns
  const conversationData = findAllConversationTurns();
  console.log(`Found ${conversationData.messages.length} conversation turns using ${conversationData.source} method`);
  
  // Process each message
  const messages = [];
  
  conversationData.messages.forEach((element, index) => {
    // Get the message role - use classes first, then alternate
    let role;
    const classStr = getClassNameString(element);
    
    if (classStr.includes('human') || classStr.includes('user')) {
      role = 'human';
    } else if (classStr.includes('claude') || classStr.includes('assistant')) {
      role = 'assistant';
    } else {
      // If no clear class indicator, try to infer from content
      const text = element.textContent.toLowerCase();
      if (text.startsWith('you:') || text.includes('human:')) {
        role = 'human';
      } else if (text.startsWith('claude:') || text.includes('assistant:')) {
        role = 'assistant';
      } else {
        // Fallback - alternate with human first (typical conversation pattern)
        role = index % 2 === 0 ? 'human' : 'assistant';
      }
    }
    
    // Extract and clean the content
    let contentElement = element;
    
    // For Claude message, look for the content div
    const contentWrappers = element.querySelectorAll('div > div');
    if (contentWrappers.length > 0) {
      // Find the wrapper with the most text content
      contentElement = Array.from(contentWrappers)
        .sort((a, b) => b.textContent.length - a.textContent.length)[0];
    }
    
    // Clone and clean up the content
    const cleanedElement = contentElement.cloneNode(true);
    
    // Process the HTML content using our helper functions
    let html = processCodeBlocks(cleanedElement.innerHTML);
    html = cleanupHtml(html);
    
    const textContent = (function() {
      // Use a temporary div to get text content from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent.trim();
    })();
    
    // Only add if we have meaningful content
    if (textContent.length > 5) {
      messages.push({
        role,
        content: html,
        textContent,
        timestamp,
        messageId: `msg-${index}`
      });
    }
  });
  
  console.log(`Final processed message count: ${messages.length}`);
  
  return {
    title: chatTitle,
    timestamp,
    messages
  };
}

// Convert chat data to Markdown using Turndown
function convertToMarkdownWithTurndown(chatData, turndownService) {
  let markdown = `# ${chatData.title}\n\n`;
  markdown += `Date: ${new Date(chatData.timestamp).toLocaleString()}\n\n`;
  
  chatData.messages.forEach((message) => {
    // Add role header
    const role = message.role === 'human' ? '## Human' : '## Claude';
    markdown += `${role}`;
    
    // Add timestamp if available
    if (message.timestamp) {
      markdown += ` (${new Date(message.timestamp).toLocaleString()})`;
    }
    markdown += '\n\n';
    
    // Use Turndown to convert HTML to Markdown
    const contentMarkdown = turndownService.turndown(message.content);
    
    markdown += `${contentMarkdown}\n\n`;
  });
  
  return markdown;
}

// Legacy fallback function for HTML to Markdown conversion
function convertToMarkdown(chatData) {
  let markdown = `# ${chatData.title}\n\n`;
  markdown += `Date: ${new Date(chatData.timestamp).toLocaleString()}\n\n`;
  
  chatData.messages.forEach((message) => {
    // Add role header
    const role = message.role === 'human' ? '## Human' : '## Claude';
    markdown += `${role}`;
    
    // Add timestamp if available
    if (message.timestamp) {
      markdown += ` (${new Date(message.timestamp).toLocaleString()})`;
    }
    markdown += '\n\n';
    
    // Process HTML content to markdown
    let content = message.content;
    
    // Convert code blocks
    content = content.replace(/<div data-code-block="([^"]*)">([\s\S]*?)<\/div>/g, (match, language, code) => {
      return '\n```' + language + '\n' + code + '\n```\n';
    });
    
    // Convert basic HTML tags
    content = content
      .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
      .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
      .replace(/<h1>([\s\S]*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>([\s\S]*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>([\s\S]*?)<\/h3>/g, '### $1\n\n')
      .replace(/<ul>([\s\S]*?)<\/ul>/g, '$1\n')
      .replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n')
      .replace(/<ol>([\s\S]*?)<\/ol>/g, '$1\n')
      .replace(/<li value="(\d+)">([\s\S]*?)<\/li>/g, '$1. $2\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
      .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`');
    
    // Remove any remaining HTML tags
    content = content.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    content = content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    markdown += `${content}\n\n`;
  });
  
  return markdown;
}