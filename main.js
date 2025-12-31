// =============== 简易视觉小说引擎（纯静态 GitHub Pages 可用） ===============

const $ = (id) => document.getElementById(id);

const el = {
  bg: $("bg"),
  charImg: $("charImg"),
  speaker: $("speaker"),
  content: $("content"),
  textbox: $("textbox"),
  choices: $("choices"),
  btnChat: $("btnChat"),
  btnMail: $("btnMail"),
  btnReset: $("btnReset"),
  mailPanel: $("mailPanel"),
  mailClose: $("mailClose"),
  mailList: $("mailList"),
  mailEmpty: $("mailEmpty"),
  mailBadge: $("mailBadge"),
  affValue: $("affValue"),
  affFill: $("affFill"),
  errorToast: $("errorToast"),
};

let story = null;

let state = {
  nodeId: null,
  affection: 0,
  unlockedMails: [],   // mailId[]
  readMails: [],       // mailId[]
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function toastError(msg){
  el.errorToast.textContent = msg;
  el.errorToast.classList.remove("hidden");
  clearTimeout(toastError._t);
  toastError._t = setTimeout(()=> el.errorToast.classList.add("hidden"), 5200);
}

function save(){
  localStorage.setItem("vn_state_v1", JSON.stringify(state));
}
function load(){
  try{
    const raw = localStorage.getItem("vn_state_v1");
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === "object"){
      state = {
        nodeId: parsed.nodeId ?? null,
        affection: Number(parsed.affection ?? 0),
        unlockedMails: Array.isArray(parsed.unlockedMails) ? parsed.unlockedMails : [],
        readMails: Array.isArray(parsed.readMails) ? parsed.readMails : [],
      };
    }
  }catch(e){}
}

function setAffection(delta){
  state.affection = clamp(state.affection + (Number(delta) || 0), -50, 200);
  el.affValue.textContent = String(state.affection);

  // 进度条：把 -50~200 映射到 0~100
  const pct = ((state.affection + 50) / 250) * 100;
  el.affFill.style.width = clamp(pct, 0, 100) + "%";
}

function updateMailBadge(){
  const unread = state.unlockedMails.filter(id => !state.readMails.includes(id)).length;
  if(unread > 0){
    el.mailBadge.textContent = String(unread);
    el.mailBadge.classList.remove("hidden");
  }else{
    el.mailBadge.classList.add("hidden");
  }
}

function openMailPanel(){
  renderMailList();
  el.mailPanel.classList.remove("hidden");
}
function closeMailPanel(){
  el.mailPanel.classList.add("hidden");
}

function renderMailList(){
  const mails = story?.mails || {};
  const list = state.unlockedMails
    .map(id => ({ id, ...mails[id] }))
    .filter(x => x && x.title);

  el.mailList.innerHTML = "";

  if(list.length === 0){
    el.mailEmpty.classList.remove("hidden");
    updateMailBadge();
    return;
  }
  el.mailEmpty.classList.add("hidden");

  for(const m of list){
    const item = document.createElement("div");
    const unread = !state.readMails.includes(m.id);
    item.className = "mail-item" + (unread ? " unread" : "");

    item.innerHTML = `
      <div class="mail-title">${escapeHtml(m.title)}</div>
      <div class="mail-meta">${escapeHtml(m.from || "未知")} · ${escapeHtml(m.date || "")}${unread ? " · 未读" : ""}</div>
      <div class="mail-body">${escapeHtml(m.body || "").replace(/\n/g, "<br>")}</div>
    `;

    item.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      if(!state.readMails.includes(m.id)){
        state.readMails.push(m.id);
        save();
      }
      renderMailList();
    });

    el.mailList.appendChild(item);
  }

  updateMailBadge();
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getNode(id){
  return story?.nodes?.[id] || null;
}

function applyScene(node){
  // 背景
  if(node.bg){
    el.bg.style.backgroundImage = `url("${node.bg}")`;
    el.bg.style.backgroundSize = "cover";
    el.bg.style.backgroundPosition = "center center";
  }
  // 立绘
  if(node.char){
    el.charImg.src = node.char;
    el.charImg.style.display = "block";
  }
}

function unlockMails(mailIds){
  if(!Array.isArray(mailIds)) return;
  for(const id of mailIds){
    if(!state.unlockedMails.includes(id)){
      state.unlockedMails.push(id);
    }
  }
  updateMailBadge();
}

function renderNode(id){
  const node = getNode(id);
  if(!node){
    toastError(`找不到节点：${id}`);
    return;
  }

  state.nodeId = id;
  save();

  applyScene(node);

  el.speaker.textContent = node.speaker || "旁白";
  el.content.textContent = node.text || "";
  el.choices.innerHTML = "";
  el.choices.classList.add("hidden");

  // 解锁邮件
  if(node.unlockMail) unlockMails(node.unlockMail);

  // 选项
  if(Array.isArray(node.choices) && node.choices.length > 0){
    el.choices.classList.remove("hidden");
    for(const c of node.choices){
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = c.text;

      btn.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        if(typeof c.delta === "number") setAffection(c.delta);
        if(c.unlockMail) unlockMails(c.unlockMail);

        if(c.next){
          renderNode(c.next);
        }
      });

      el.choices.appendChild(btn);
    }
  }

  updateMailBadge();
}

function nextByClick(){
  // 有选项时不允许点背景跳过（避免误触）
  if(!el.choices.classList.contains("hidden")) return;

  const node = getNode(state.nodeId);
  if(!node) return;

  if(node.next){
    renderNode(node.next);
  }
}

// 初始化
async function init(){
  load();
  setAffection(0); // 初始化条（不改变数值，只刷新 UI）
  el.affValue.textContent = String(state.affection);

  // 读取 story.json
  try{
    const res = await fetch("story.json", { cache: "no-store" });
    const text = await res.text();

    // JSON 解析
    story = JSON.parse(text);

    // 校验结构
    if(!story || typeof story !== "object") throw new Error("story.json 不是对象");
    if(!story.start || !story.nodes) throw new Error("story.json 缺少 start 或 nodes 字段");

  }catch(err){
    toastError(`story.json 加载失败：${err.message}`);
    // 兜底：提供最小故事，避免彻底卡死
    story = {
      start: "start",
      mails: {},
      nodes: {
        start: {
          speaker: "ERROR",
          text: "story.json 无法加载或结构不对。请检查 JSON 是否合法，以及是否包含 start 和 nodes。",
          bg: "assets/bg.png",
          char: "assets/charA.png",
        }
      }
    };
  }

  // 绑定按钮
  el.btnReset.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    localStorage.removeItem("vn_state_v1");
    state = { nodeId: null, affection: 0, unlockedMails: [], readMails: [] };
    setAffection(0);
    updateMailBadge();
    renderNode(story.start);
  });

  el.btnMail.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    if(el.mailPanel.classList.contains("hidden")) openMailPanel();
    else closeMailPanel();
  });

  el.mailClose.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    closeMailPanel();
  });

  // 点击对话框推进
  el.textbox.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    nextByClick();
  });

  // 点击背景推进（同样有效）
  document.body.addEventListener("click", ()=>{
    nextByClick();
  });

  // 恢复节点
  const startId = state.nodeId && getNode(state.nodeId) ? state.nodeId : story.start;

  // 刷新 UI
  setAffection(0);
  updateMailBadge();
  renderNode(startId);
}

init();
