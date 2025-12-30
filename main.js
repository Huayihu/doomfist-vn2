const $ = (sel) => document.querySelector(sel);

const state = {
  story: null,
  nodeId: null,
  affection: 0,
  unreadMail: 0,
  mode: "chat"
};

const dom = {
  charImg: $("#charImg"),
  speaker: $("#speaker"),
  text: $("#text"),
  textbox: $("#textbox"),
  choices: $("#choices"),
  affValue: $("#affValue"),
  affFill: $("#affFill"),
  btnChat: $("#btnChat"),
  btnMail: $("#btnMail"),
  btnReset: $("#btnReset"),
  mailBadge: $("#mailBadge"),
  mailPanel: $("#mailPanel"),
  btnCloseMail: $("#btnCloseMail"),
  mailList: $("#mailList")
};

// === 你 assets 里现在是 charA.png / charB.png（从你截图看 charB 已有）===
const SPRITES = {
  A: "assets/charA.png",
  B: "assets/charB.png"
};

const AFF_MAX_FOR_BAR = 30;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setAffection(v){
  state.affection = v;
  if (dom.affValue) dom.affValue.textContent = String(state.affection);
  if (dom.affFill){
    const pct = clamp((state.affection / AFF_MAX_FOR_BAR) * 100, 0, 100);
    dom.affFill.style.width = `${pct}%`;
  }
}

function setUnreadMail(n){
  state.unreadMail = n;
  if (!dom.mailBadge) return;
  if (n > 0){
    dom.mailBadge.classList.remove("hidden");
    dom.mailBadge.textContent = String(n);
  } else {
    dom.mailBadge.classList.add("hidden");
  }
}

function setMode(mode){
  state.mode = mode;
  dom.btnChat?.classList.toggle("is-active", mode === "chat");
  dom.btnMail?.classList.toggle("is-active", mode === "mail");

  if (!dom.mailPanel) return;
  if (mode === "mail") dom.mailPanel.classList.remove("hidden");
  else dom.mailPanel.classList.add("hidden");
}

function showStatusTag(text, isError=false){
  let tag = document.getElementById("statusTag");
  if (!tag){
    tag = document.createElement("div");
    tag.id = "statusTag";
    tag.style.position = "fixed";
    tag.style.top = "8px";
    tag.style.right = "8px";
    tag.style.zIndex = "9999";
    tag.style.padding = "6px 10px";
    tag.style.borderRadius = "10px";
    tag.style.fontSize = "12px";
    tag.style.backdropFilter = "blur(8px)";
    tag.style.border = "1px solid rgba(255,255,255,0.18)";
    tag.style.background = "rgba(0,0,0,0.35)";
    tag.style.color = "white";
    document.body.appendChild(tag);
  }
  tag.textContent = text;
  tag.style.background = isError ? "rgba(180,0,40,0.55)" : "rgba(0,80,40,0.45)";
}

function renderChoices(choices){
  if (!dom.choices) return;
  dom.choices.innerHTML = "";

  if (!choices || choices.length === 0){
    dom.choices.classList.add("hidden");
    return;
  }
  dom.choices.classList.remove("hidden");

  for (const c of choices){
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = c.text;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const delta = Number(c.affectionDelta || 0);
      setAffection(state.affection + delta);
      renderNode(c.next);
    });

    dom.choices.appendChild(btn);
  }
}

function renderNode(nodeId){
  if (!state.story?.nodes) return;

  const node = state.story.nodes[nodeId];
  if (!node){
    dom.speaker.textContent = "ERROR";
    dom.text.textContent = `找不到节点：${nodeId}`;
    renderChoices([]);
    return;
  }

  state.nodeId = nodeId;

  dom.speaker.textContent = node.speaker ?? "旁白";
  dom.text.textContent = node.text ?? "";

  const spriteKey = node.sprite ?? "A";
  if (dom.charImg){
    dom.charImg.src = SPRITES[spriteKey] || SPRITES.A;
  }

  renderChoices(node.choices || []);
}

async function loadStory(){
  // 强制绕过缓存，避免 Pages 还在读旧文件
  const url = `story.json?v=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok){
    throw new Error(`story.json 请求失败：HTTP ${res.status}`);
  }
  const text = await res.text();

  // 明确提示 JSON 语法问题
  try{
    return JSON.parse(text);
  }catch(e){
    throw new Error(`story.json 不是合法 JSON：${e.message}`);
  }
}

function resetGame(){
  setAffection(0);
  setUnreadMail(1);     // 你想默认有信就 1；不想就 0
  setMode("chat");

  // 防止 story 未加载时 reset 报错
  if (!state.story?.start){
    dom.speaker.textContent = "ERROR";
    dom.text.textContent = "Story 未加载，无法开始。";
    return;
  }
  renderNode(state.story.start);
}

function initEvents(){
  // 点击对话框继续：若有选项就不跳，避免误点
  dom.textbox?.addEventListener("click", () => {
    const node = state.story?.nodes?.[state.nodeId];
    const hasChoices = node?.choices?.length > 0;
    if (hasChoices) return;
  });

  dom.btnChat?.addEventListener("click", () => setMode("chat"));
  dom.btnMail?.addEventListener("click", () => setMode("mail"));
  dom.btnCloseMail?.addEventListener("click", () => setMode("chat"));
  dom.btnReset?.addEventListener("click", resetGame);

  dom.mailPanel?.addEventListener("click", (e) => {
    if (e.target === dom.mailPanel) setMode("chat");
  });
}

(async function boot(){
  try{
    initEvents();
    showStatusTag("Booting...");

    state.story = await loadStory();
    showStatusTag("Loaded ✓");

    // 验证 story 结构
    if (!state.story.start || !state.story.nodes){
      throw new Error("story.json 缺少 start 或 nodes 字段");
    }

    resetGame();
  }catch(err){
    console.error(err);
    showStatusTag("ERROR ✗", true);
    if (dom.speaker) dom.speaker.textContent = "ERROR";
    if (dom.text) dom.text.textContent = String(err?.message || err);
    if (dom.choices) dom.choices.classList.add("hidden");
    // 出错时也把邮件显示出来，方便你确认 UI 是否工作
    setUnreadMail(1);
  }
})();
