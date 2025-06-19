let pageData = {};

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: getPageInfo,
  }, ([res]) => {
    const { title, url, content } = res.result;
    pageData = { title, url, content };

    document.getElementById("title").textContent = title;
    document.getElementById("url").textContent = url;
  });

  document.getElementById("summarize").addEventListener("click", async () => {
    const summary = await summarizeText(pageData.content);
    document.getElementById("summary").value = summary;
    pageData.summary = summary;
  });

  document.getElementById("send").addEventListener("click", () => {
    console.log("Sending to backend:", pageData);
  });
});

function getPageInfo() {
  const title = document.title;
  const url = window.location.href;
  const article = document.querySelector("article");
  const content = article ? article.innerText : document.body.innerText.slice(0, 3000);
  return { title, url, content };
}

async function summarizeText(text) {
  return "SUMMARY PLACEHOLDER IMMA RPEPLACE WITH LLM";
}
