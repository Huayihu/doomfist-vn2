/* ====== 基础状态 ====== */
const STATE_KEY = "vn_demo_state_v1";

let story = null;
let currentNodeId = null;

let affection = 0;
let mails = [];        // {title, from, body, read, id}
let unread = 0;

const $ = (id) => document.getElementById(id);

const el = {
  charImg: $("charImg"),
  speaker: $("speaker"),
  text: $("text"),
  textbox: $("textbox"),
  choices: $("choices"),
  affValue: $("affValue"),
  affFill: $("affFill"),
  mailBadge: $("mailBadge"),
  mailPanel: $("mailPanel"),
  mailList: $("mailList"),
  toast: $("toast"),
  btnChat: $("btnChat"),
  btnMail: $("btnMail"),
  btnReset: $("btnReset"),
  btnSave: $("btnSave"),
  btnLoad: $("btnLoad"),
  mailClose: $("mailClose")
};

/* ====== 工具 ====== */
function showToast(msg){
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> el.toast.classList.add("hidden"), 2600);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function updateAffUI(){
  el.affValue.textContent = String(affection);
  // 视觉条：把 -10~+30 映射到 0~100（你后面可以自己改范围）
  const pct = ((clamp(affection, -10, 30) + 10) / 40) * 100;
  el.affFill.style.width = `${pct}%`;
}

function updateMailUI(){
  unread = mails.filter(m => !m.read).length;
  if(unread > 0){
    el.mailBadge.textContent = String(unread);
    el.mailBadge.classList.remove("hidden");
  }else{
    el.mailBadge.classList.add("hidden");
  }

  el.mailList.innerHTML = "";
  if(mails.length === 0){
    el.mailList.innerHTML = `<div style="color:rgba(255,255,255,0.75)">暂无信件（在 story.json 的节点里用 mailAdd 添加）</div>`;
    return;
  }

  mails.slice().reverse().forEach((m, idx) => {
    const item = document.createElement("div");
    item.className = "mail-item";
    item.innerHTML = `
      <div class="mail-title">${m.read ? "" : "（未读）"}${escapeHtml(m.title)}</div>
      <div class="mail-meta">From: ${escapeHtml(m.from)}</div>
      <div class="mail-body">${escapeHtml(m.body)}</div>
      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="pill small" data-act="toggleRead" data-id="${m.id}">${m.read ? "标为未读" : "标为已读"}</button>
        <button class="pill small" data-act="delete" data-id="${m.id}">删除</button>
      </div>
    `;
    el.mailList.appendChild(item);
  });

  el.mailList.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      const i = mails.findIndex(x => x.id === id);
      if(i < 0) return;
      if(act === "toggleRead"){
        mails[i].read = !mails[i].read;
      }else if(act === "delete"){
        mails.splice(i,1);
      }
      persist();
      updateMailUI();
    });
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;")
    .replaceAll("\n","<br/>");
}

function persist(){
  const state = {
    currentNodeId,
    affection,
    mails
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadPersist(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !s.currentNodeId) return false;
    currentNodeId = s.currentNodeId;
    affection = Number.isFinite(s.affection) ? s.affection : 0;
    mails = Array.isArray(s.mails) ? s.mails : [];
    return true;
  }catch{
    return false;
  }
}

/* ====== VN 渲染逻辑 ====== */
function setChar(src){
  if(src) el.charImg.src = src;
}

function setText(speaker, textHtml){
  el.speaker.textContent = speaker || "旁白";
  el.text.innerHTML = textHtml || "";
}

function hideChoices(){
  el.choices.classList.add("hidden");
  el.choices.innerHTML = "";
}

function showChoices(choices){
  el.choices.innerHTML = "";
  el.choices.classList.remove("hidden");

  choices.forEach(ch=>{
    const b = document.createElement("button");
    b.className = "choice-btn";
    b.textContent = ch.text || "（无文本）";
    b.addEventListener("click", (e)=>{
      e.stopPropagation();

      // 好感变化
      const d = Number(ch.affectionDelta || 0);
      if(Number.isFinite(d) && d !== 0){
        affection += d;
        updateAffUI();
      }

      // 跳转
      if(ch.next){
        gotoNode(ch.next);
      }
    });
    el.choices.appendChild(b);
  });
}

function applyMailAdd(node){
  const arr = node.mailAdd;
  if(!Array.isArray(arr) || arr.length === 0) return;

  arr.forEach(m=>{
    const mail = {
      id: cryptoRandomId(),
      title: m.title || "信件",
      from: m.from || "未知",
      body: m.body || "",
      read: false
    };
    mails.push(mail);
  });
  persist();
  updateMailUI();
}

function cryptoRandomId(){
  // 兼容性好一点
  return "m_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}

function gotoNode(id){
  const node = story.nodes[id];
  if(!node){
    showToast(`节点不存在：${id}`);
    return;
  }
  currentNodeId = id;

  // 立绘
  if(node.char) setChar(node.char);

  // 邮件
  applyMailAdd(node);

  // 文本（text 可以是字符串或数组）
  let textHtml = "";
  if(Array.isArray(node.text)){
    textHtml = node.text.map(line => escapeHtml(line)).join("<br/><br/>");
  }else{
    textHtml = escapeHtml(node.text || "");
  }
  setText(node.speaker, textHtml);

  // 选项 / next
  hideChoices();
  if(Array.isArray(node.choices) && node.choices.length > 0){
    showChoices(node.choices);
  }

  updateAffUI();
  persist();
}

function advance(){
  const node = story.nodes[currentNodeId];
  if(!node) return;

  // 有选项时，不自动 next（必须点选项）
  if(Array.isArray(node.choices) && node.choices.length > 0){
    return;
  }

  if(node.next){
    gotoNode(node.next);
  }
}

/* ====== 初始化 ====== */
async function loadStory(){
  try{
    const res = await fetch("story.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if(!data || !data.start || !data.nodes){
      throw new Error("story.json 缺少 start 或 nodes 字段");
    }
    story = data;
  }catch(err){
    // 把错误直接显示到对话框里，方便你排查
    setText("ERROR", `story.json 读取失败：${escapeHtml(err.message || String(err))}`);
    showToast("story.json 读取失败（看对话框错误信息）");
    return false;
  }
  return true;
}

function resetAll(){
  localStorage.removeItem(STATE_KEY);
  affection = 0;
  mails = [];
  updateAffUI();
  updateMailUI();
  gotoNode(story.start);
}

function openMail(){
  el.mailPanel.classList.remove("hidden");
  updateMailUI();
}
function closeMail(){
  el.mailPanel.classList.add("hidden");
}

/* 事件绑定：确保“点不动”不会发生 */
function bindEvents(){
  // 点击对话框推进
  el.textbox.addEventListener("click", ()=> advance());
  // 点击背景也推进（但点到按钮/面板不推进）
  $("app").addEventListener("click", (e)=>{
    const tag = e.target;
    const inPanel = tag.closest(".panel");
    const inButton = tag.closest("button");
    const inChoices = tag.closest(".choices");
    if(inPanel || inButton || inChoices) return;
    advance();
  });

  el.btnChat.addEventListener("click", ()=>{
    closeMail();
    // 回到对话视觉（不改节点）
    showToast("聊天界面");
  });

  el.btnMail.addEventListener("click", ()=> openMail());
  el.mailClose.addEventListener("click", ()=> closeMail());

  el.btnReset.addEventListener("click", ()=>{
    resetAll();
    showToast("已重置");
  });

  el.btnSave.addEventListener("click", ()=>{
    persist();
    showToast("已存档");
  });

  el.btnLoad.addEventListener("click", ()=>{
    const ok = loadPersist();
    if(ok){
      updateAffUI();
      updateMailUI();
      gotoNode(currentNodeId);
      showToast("已读档");
    }else{
      showToast("没有可用存档");
    }
  });

  // 适配：窗口变化时不需要额外处理（CSS 已做）
}

/* 启动 */
(async function init(){
  bindEvents();
  const ok = await loadStory();
  if(!ok) return;

  // 读档优先
  const hasSave = loadPersist();
  updateAffUI();
  updateMailUI();

  if(hasSave){
    gotoNode(currentNodeId);
  }else{
    affection = 0;
    mails = [];
    gotoNode(story.start);
  }
})();
