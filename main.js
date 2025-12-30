const $ = (sel) => document.querySelector(sel);

const state = {
  story: null,
  nodeId: null,
  affection: 0,
  unreadMail: 0,
  mode: "chat" // chat / mail
};

const dom = {
  bg: $("#bg"),
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

const SPRITES = {
  A: "assets/charA.png",
  B: "assets/charB.png"
};

// 你可以改这个上限：用于显示进度条（不是硬限制）
const AFF_MAX_FOR_BAR = 30;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setAffection(v){
  state.affection = v;
  dom.affValue.textContent = String(state.affection);
  const pct = clamp((state.affection / AFF_MAX_FOR_BAR) * 100, 0, 100);
  dom.affFill.style.width = `${pct}%`;
}

function setUnreadMail(n){
  state.unreadMail = n;
  if (n > 0){
    dom.mailBadge.classList.remove("hidden");
    dom.mailBadge.textContent = String(n);
  } else {
    dom.mailBadge.classList.add("hidden");
  }
}

function setMode(mode){
  state.mode = mode;
  dom.btnChat.classList.toggle("is-active", mode === "chat");
  dom.btnMail.classList.toggle("is-active", mode === "mail");

  if (mode === "mail"){
    dom.mailPanel.classList.remove("hidden");
  } else {
    dom.mailPanel.classList.add("hidden");
  }
}

function renderNode(nodeId){
  const node = state.story.nodes[nodeId];
  if (!node) return;

  state.nodeId = nodeId;

  dom.speaker.textContent = node.speaker ?? "旁白";
  dom.text.textContent = node.text ?? "";

  // 立绘切换
  const spriteKey = node.sprite ?? "A";
  dom.charImg.src = SPRITES[spriteKey] || SPRITES.A;

  // 渲染选项
  renderChoices(node.choices || []);
}

function renderChoices(choices){
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

async function loadStory(){
  const res = await fetch("story.json", { cache: "no-store" });
  state.story = await res.json();
  return state.story;
}

function resetGame(){
  setAffection(0);
  setUnreadMail(1); // 你想一开始就显示“信件1”就保留；不想就改 0
  setMode("chat");
  renderNode(state.story.start);
}

function initEvents(){
  // 点击对话框：如果当前有选项，不自动跳（避免误点）
  dom.textbox.addEventListener("click", () => {
    const node = state.story.nodes[state.nodeId];
    const hasChoices = node?.choices?.length > 0;
    if (hasChoices) return;

    // 没有选项时：默认重复本节点（你以后想做“下一句”可在 story 里加 next 字段）
    renderNode(state.nodeId);
  });

  dom.btnChat.addEventListener("click", () => setMode("chat"));
  dom.btnMail.addEventListener("click", () => setMode("mail"));
  dom.btnCloseMail.addEventListener("click", () => setMode("chat"));
  dom.btnReset.addEventListener("click", resetGame);

  // 点击遮罩关闭信件
  dom.mailPanel.addEventListener("click", (e) => {
    if (e.target === dom.mailPanel) setMode("chat");
  });
}

(async function boot(){
  initEvents();
  await loadStory();

  // 背景已在 CSS 里写死为 assets/bg.png，这里不需要再 set
  resetGame();
})();
