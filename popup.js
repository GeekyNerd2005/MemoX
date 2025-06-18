document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const loggedItemsContainer = document.getElementById('loggedItemsContainer');
  const goToProfileBtn = document.getElementById('goToProfileBtn');

  const updateStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      statusDiv.textContent = response.message;
      if (response.recentItems && response.recentItems.length > 0) {
        loggedItemsContainer.innerHTML = ''; 
        response.recentItems.forEach(item => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'logged-item';
          itemDiv.innerHTML = `
            <a href="${item.url}" target="_blank">${item.title || item.url}</a>
            <div class="summary">${item.summary ? item.summary.substring(0, 100) + '...' : 'Summarizing...'}</div>
          `;
          loggedItemsContainer.prepend(itemDiv); 
        });
      } else {
        loggedItemsContainer.innerHTML = '<div class="status">No items logged yet.</div>';
      }
    } catch (error) {
      console.error("Error getting status:", error);
      statusDiv.textContent = 'Error: Could not connect.';
    }
  };

  updateStatus();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_POPUP') {
      updateStatus();
    }
  });


  goToProfileBtn.addEventListener('click', () => {
    const profileUrl = 'http://localhost:3000/profile'; 
    chrome.tabs.create({ url: profileUrl });
  });
});