# Troubleshooting Guide for Claude.ai Chat Exporter

If you're experiencing issues with the Claude.ai Chat Exporter extension, try the following solutions:

## Common Issues and Solutions

### "Could not establish connection. Receiving end does not exist."

This error typically means the content script hasn't loaded properly on the Claude.ai page.

**Solutions:**
1. Refresh the Claude.ai page completely (Ctrl+F5 or Cmd+Shift+R)
2. Close and reopen the extension popup
3. Navigate to a different Claude.ai chat and back
4. Disable and re-enable the extension in Chrome's extensions page

### Extension Not Working on Claude.ai

**Solutions:**
1. Make sure you're on a URL that matches `https://claude.ai/chat/*` or `https://claude.ai/chats/*`
2. Check that the extension has the correct permissions. In Chrome, go to:
   - Settings > Extensions > Claude.ai Chat Exporter > Details > Site access
   - Ensure it has access to claude.ai

### Export Gives Incomplete or Incorrect Data

**Solutions:**
1. Make sure all chat messages are loaded in the browser (scroll up in long conversations)
2. Check if you're viewing a conversation with unique formatting that might not be properly extracted
3. Use the Debug Page Structure button to analyze why the extension can't find messages
4. Check the browser console logs for additional information

### Export Button Does Nothing

**Solutions:**
1. Check the browser console for errors (press F12, then go to the Console tab)
2. Reinstall the extension
3. Make sure your Chrome browser is up to date

## Using the Debug Feature

The extension includes a debug feature to help diagnose extraction issues:

1. Navigate to the Claude.ai chat you want to export
2. Click the extension icon and then click "Debug Page Structure"
3. Save the JSON file when prompted
4. The file contains information about the page structure that can help diagnose why messages aren't being found

## Manual Debugging

For more advanced users, you can manually debug the extension:

1. Go to `chrome://extensions/`
2. Find Claude.ai Chat Exporter and click "Details"
3. Enable "Developer mode" if not already enabled
4. Click "Inspect views: background page" to see the background script console
5. On a Claude.ai chat page, open Chrome DevTools (F12) and check for errors

## Still Having Issues?

If you continue to experience problems:

1. Check if the Claude.ai website has been updated recently (which might break the extension)
2. Look for updated versions of this extension
3. Try the debug feature to analyze the page structure and adjust the selectors accordingly