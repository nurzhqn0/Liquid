// content.js — Option(⌥)+Left Click to ask Groq and show ONLY { answer }
// Make sure your server is running at http://localhost:3001/ask

const API_URL = "http://localhost:3001/ask";

let tipEl = null;
let lastRequestId = 0;

function removeTip() {
  if (tipEl) tipEl.remove();
  tipEl = null;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function createTip(x, y) {
  removeTip();

  tipEl = document.createElement("div");
  tipEl.id = "ai-helper-tip";
  tipEl.style.position = "fixed";
  tipEl.style.zIndex = "2147483647";
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;
  tipEl.style.width = "320px";
  tipEl.style.maxWidth = "calc(100vw - 24px)";
  tipEl.style.borderRadius = "12px";
  tipEl.style.background = "#fff";
  tipEl.style.color = "#111827";
  tipEl.style.border = "1px solid rgba(17,24,39,.12)";
  tipEl.style.boxShadow = "0 12px 30px rgba(0,0,0,.18)";
  tipEl.style.overflow = "hidden";
  tipEl.style.fontSize = "11px"; // small letters
  tipEl.style.lineHeight = "1.35";

  tipEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 10px 8px;background:#f9fafb;border-bottom:1px solid rgba(17,24,39,.08)">
      <div style="font-weight:700;font-size:12px">AI Helper</div>
      <div style="display:flex;gap:6px">
        <button data-action="copy" style="font-size:11px;padding:4px 8px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:#fff;cursor:pointer">Copy</button>
        <button data-action="close" style="font-size:11px;padding:4px 8px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:#fff;cursor:pointer">×</button>
      </div>
    </div>
    <div style="padding:10px">
      <div style="margin-bottom:8px">
        <div style="font-weight:700;margin-bottom:2px;font-size:11px">Status</div>
        <div id="aih-status" style="color:#6b7280;white-space:pre-wrap">Thinking…</div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:2px;font-size:11px">Answer</div>
        <div id="aih-answer" style="white-space:pre-wrap">—</div>
      </div>
    </div>
  `;

  tipEl.addEventListener("click", (e) => {
    const action = e.target?.dataset?.action;
    if (!action) return;

    if (action === "close") {
      removeTip();
      return;
    }

    if (action === "copy") {
      const ans = tipEl.querySelector("#aih-answer")?.textContent || "";
      navigator.clipboard.writeText(ans).catch(() => {});
    }
  });

  document.documentElement.appendChild(tipEl);
}

function getUsefulTextFromTarget(target) {
  if (!target) return "";

  // Try to grab a "question block" rather than tiny inner spans.
  // Walk up a few levels to find a container with enough text.
  let el = target;
  for (let i = 0; i < 5; i++) {
    const t = (el.innerText || el.textContent || "").trim();
    if (t.length >= 30) return t;
    el = el.parentElement;
    if (!el) break;
  }

  // Fallback to target text
  return (target.innerText || target.textContent || "").trim();
}

async function askServer(text) {
  const reqId = ++lastRequestId;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  // If another request happened after this started, ignore this response
  if (reqId !== lastRequestId) return null;

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Server error ${res.status}`);
  }

  const data = await res.json();
  return data;
}

// Option(⌥) + Left Click
document.addEventListener(
  "click",
  async (e) => {
    // On macOS, Option key is `altKey`
    if (!e.altKey) return;

    // Only left click
    if (e.button !== 0) return;

    // Prevent the website click action when using Option+Click
    e.preventDefault();
    e.stopPropagation();

    const rawText = getUsefulTextFromTarget(e.target);
    const text = (rawText || "").trim().slice(0, 4000);
    if (text.length < 5) return;

    const x = clamp(e.clientX + 12, 8, window.innerWidth - 340);
    const y = clamp(e.clientY + 12, 8, window.innerHeight - 180);

    createTip(x, y);

    const statusEl = tipEl.querySelector("#aih-status");
    const answerEl = tipEl.querySelector("#aih-answer");

    try {
      statusEl.textContent = "Calling server…";
      answerEl.textContent = "—";

      const data = await askServer(text);
      if (!data) return;

      statusEl.textContent = "Done";
      answerEl.textContent = (data.answer ?? "—").toString();
    } catch (err) {
      statusEl.textContent = "Error";
      statusEl.style.color = "#b91c1c";
      answerEl.textContent = (err?.message || String(err)).slice(0, 500);
    }
  },
  true, // capture so we can stop clicks before the page handles them
);

// Close tooltip on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removeTip();
});

// Close tooltip if clicking outside (normal click)
document.addEventListener("mousedown", (e) => {
  if (!tipEl) return;
  if (tipEl.contains(e.target)) return;
  removeTip();
});
