const $ = (id) => document.getElementById(id);

const bg = $("bg");
const textbox = $("textbox");
const speakerEl = $("speaker");
const textEl = $("text");
const choicesEl = $("choices");
const debugEl = $("debug");

const tabChat = $("tabChat");
const tabMail = $("tabMail");
const mailBadge = $("mailBadge");

const btnReset = $("btnReset");
const btnBack = $("btnBack");
const btnSave = $("btnSave");
const btnLoad = $("btnLoad");

const shakeLayer = $("shakeLayer");
const charImg = $("charImg");

const affValueEl = $("affValue");
const affFillEl  = $("affFill");
const affDeltaEl = $("affDelta");

const mailPanel = $("mailPanel");
const mailClose = $("mailClose");
const mailPrev = $("mailPrev");
const mailNext = $("mailNext");
const mailMarkRead = $("mailMarkRead");

const mailList = $("mailList");
const mailSubject = $("mailSubject");
const mailMeta = $("mailMeta");
const mailContent = $("mailContent");
const mailSign = $("mailSign");

/** =====================
 * 状态
 * ===================== */
let nodeId = null;
let history = [];
let uiMode = "chat"; // chat | mail

// 你要求：好感度从 0 开始
let vars = {
  affection: 0,
  trust: 0
};

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

/** =====================
 * 演出
 * ===================== */
function screenShake(){
  shakeLayer.classList.remove("shake");
  void shakeLayer.offsetWidth;
  shakeLayer.classList.add("shake");
}

function charBounce(){
  charImg.classList.remove("char-bounce");
  void charImg.offsetWidth;
  charImg.classList.add("char-bounce");
}

function setCharacter(src, opts={}){
  if (!src) return;
  const { bounce=false } = opts;

  if (charImg.getAttribute("src") === src){
    if (bounce) charBounce();
    return;
  }
  charImg.style.opacity = "0";
  setTimeout(()=>{
    charImg.src = src;
    charImg.style.opacity = "1";
    if (bounce) charBounce();
  }, 120);
}

/** =====================
 * 好感度 UI：0~100 映射
 * ===================== */
function renderAffection(delta=0){
  affValueEl.textContent = String(vars.affection);

  // 0~100 映射到进度条（你后面要改上限就改这里）
  const pct = clamp(vars.affection / 100, 0, 1);
  affFillEl.style.width = `${Math.round(pct * 100)}%`;

  if (delta !== 0){
    affDeltaEl.textContent = (delta>0?`+${delta}`:`${delta}`);
    affDeltaEl.classList.remove("hidden");
    requestAnimationFrame(()=> affDeltaEl.classList.add("show"));
    setTimeout(()=>{
      affDeltaEl.classList.remove("show");
      setTimeout(()=> affDeltaEl.classList.add("hidden"), 160);
    }, 650);
  }
}

/** =====================
 * 信件系统（未读/解锁/剧情投递）
 * ===================== */
let mails = [];
let mailIndex = 0;

const MAIL_LIBRARY = [
  {
    id: "m0",
    subject: "嗨，亲爱的安娜",
    content:
`见字如面。还记得上钩拳的滋味吗？我们已经很久没有起飞了。
怀念和你在一起的时光。为了纪念我们的友情，请到里阿尔托大饭店666包厢，
我带了你最爱的东西。不用带特别的东西，轻装上阵，尤其是睡针和禁疗瓶子，
放在家里就好。我在这里等候你的光临。`,
    sign: "—— 末日铁拳",
    unlockAt: 0,
  },
  {
    id: "m1",
    subject: "关于“迟到”",
    content:
`我不喜欢反复强调同一件事。
迟到意味着你把时间交给了别人，而不是交给你自己。
如果你要来，就像一拳一样干脆。`,
    sign: "—— 末日铁拳",
    unlockAt: 15,  // 从 0 起步：更早解锁
  },
  {
    id: "m2",
    subject: "你在试探我",
    content:
`你以为我看不出来。
你问问题的方式、停顿的节奏、甚至你选择沉默的那一秒——
都在衡量我的边界。
可以。继续。你越谨慎，越接近我想要的人。`,
    sign: "—— 末日铁拳",
    unlockAt: 30,
  }
];

function initMails(){
  mails = MAIL_LIBRARY.map(m => ({
    ...m,
    createdAt: Date.now(),
    preview: (m.content || "").replace(/\s+/g," ").slice(0, 22),
    unread: m.unlockAt === 0,
    unlocked: m.unlockAt === 0
  }));
}

function getUnlockedMails(){
  return mails.filter(m => m.unlocked);
}

function countUnread(){
  return mails.filter(m => m.unlocked && m.unread).length;
}

function renderMailBadge(){
  const n = countUnread();
  if (n > 0){
    mailBadge.textContent = String(n);
    mailBadge.classList.remove("hidden");
  }else{
    mailBadge.classList.add("hidden");
  }
}

function unlockMailsByAffection(){
  let newly = 0;
  for (const m of mails){
    if (!m.unlocked && vars.affection >= (m.unlockAt ?? 0)){
      m.unlocked = true;
      m.unread = true;
      newly++;
    }
  }
  if (newly > 0){
    renderMailBadge();
    tabMail.classList.add("active");
    setTimeout(()=>{ if (uiMode === "chat") tabMail.classList.remove("active"); }, 700);
  }
}

function openMail(){
  uiMode = "mail";
  mailPanel.classList.remove("hidden");
  tabMail.classList.add("active");
  tabChat.classList.remove("active");
  renderMailUI();
}

function closeMail(){
  uiMode = "chat";
  mailPanel.classList.add("hidden");
  tabChat.classList.add("active");
  tabMail.classList.remove("active");
}

function renderMailList(){
  const list = getUnlockedMails();
  mailList.innerHTML = "";

  if (list.length === 0){
    const empty = document.createElement("div");
    empty.className = "mail-item";
    empty.innerHTML = `<div class="mail-item-title">暂无已解锁信件</div>
                       <div class="mail-item-sub">提高好感度可解锁新信件</div>`;
    mailList.appendChild(empty);
    return;
  }

  list.forEach((m, idx)=>{
    const item = document.createElement("div");
    item.className = "mail-item" + (idx === mailIndex ? " active" : "");
    item.innerHTML = `
      <div class="mail-item-title">${escapeHtml(m.subject || "（无标题）")}</div>
      <div class="mail-item-sub">${escapeHtml(m.preview || "")}</div>
      ${m.unread ? `<div class="mail-dot"></div>` : ``}
    `;
    item.addEventListener("click", (e)=>{
      e.stopPropagation();
      mailIndex = idx;
      renderMailUI();
    });
    mailList.appendChild(item);
  });
}

function renderMailView(){
  const list = getUnlockedMails();
  if (!list.length){
    mailSubject.textContent = "（无）";
    mailMeta.textContent = "";
    mailContent.textContent = "";
    mailSign.textContent = "";
    return;
  }

  mailIndex = clamp(mailIndex, 0, list.length - 1);
  const m = list[mailIndex];

  mailSubject.textContent = m.subject ?? "";
  mailMeta.textContent = `状态：${m.unread ? "未读" : "已读"}  ｜ 解锁阈值：${m.unlockAt ?? 0}`;
  mailContent.textContent = m.content ?? "";
  mailSign.textContent = m.sign ?? "";

  renderMailBadge();
}

function renderMailUI(){
  renderMailList();
  renderMailView();
}

function markCurrentMailRead(){
  const list = getUnlockedMails();
  if (!list.length) return;
  const m = list[mailIndex];
  m.unread = false;
  renderMailUI();
}

function prevMail(){
  const list = getUnlockedMails();
  if (!list.length) return;
  mailIndex = clamp(mailIndex - 1, 0, list.length - 1);
  renderMailUI();
}
function nextMail(){
  const list = getUnlockedMails();
  if (!list.length) return;
  mailIndex = clamp(mailIndex + 1, 0, list.length - 1);
  renderMailUI();
}

function deliverMail(mail){
  const id = mail.id ?? `mx_${Date.now()}`;
  const m = {
    id,
    subject: mail.subject ?? "（无标题）",
    content: mail.content ?? "",
    sign: mail.sign ?? "",
    unlockAt: 0,
    unlocked: true,
    unread: true,
    createdAt: Date.now(),
    preview: (mail.content || "").replace(/\s+/g," ").slice(0, 22),
  };
  mails.push(m);
  renderMailBadge();

  tabMail.classList.add("active");
  setTimeout(()=>{ if (uiMode === "chat") tabMail.classList.remove("active"); }, 700);
}

/** =====================
 * 剧情（选择差异好感更明显）
 * ===================== */
const STORY = {
  start: "n0",
  nodes: {
    n0: {
      char: "assets/doomfist_calm.png",
      speaker:"旁白",
      text:"你点开了那条陌生的未读信息。\n（右上角“信件”可查看；好感度升高会解锁更多信件。）",
      next:"n1"
    },
    n1: { speaker:"你", text:"这不像恶作剧。语气很笃定，像是在下命令……但又像是在邀请。", next:"n2" },
    n2: { speaker:"旁白", text:"终端响起一声短促提示音。", next:"n3" },

    n3: {
      speaker:"Doomfist",
      char:"assets/doomfist_calm.png",
      text:"你终于看了。\n我不喜欢等待，但我承认——你值得我破例。",
      choices:[
        { label:"（冷静）你是谁？你想要什么？", to:"c1_a" },
        { label:"（不示弱）你凭什么觉得我会来？", to:"c1_b" },
        { label:"（试探）如果我拒绝呢？", to:"c1_c" }
      ]
    },

    // 从 0 起步，差异拉开
    c1_a: { speaker:"Doomfist", text:"问题不错。\n我需要一个不被恐惧牵着走的人。", add:{affection:+6, trust:+1}, next:"n4" },
    c1_b: { speaker:"Doomfist", text:"凭你的眼神。\n你看见危险时，不会后退——你会计算距离。", add:{affection:+9, trust:+1}, next:"n4" },
    c1_c: { speaker:"Doomfist", text:"拒绝当然可以。\n只是你会错过一次把命运握在手里的机会。", add:{affection:-4, trust:-1}, next:"n4" },

    n4: { speaker:"旁白", text:"他发来地点：一处灯光过亮的大厅。\n你知道这不是什么“普通见面”。", next:"n5" },
    n5: { speaker:"你", text:"你说要我带什么？", next:"n6" },

    n6: {
      speaker:"Doomfist",
      text:"别带武器。\n带你的判断力。\n还有——别迟到。",
      choices:[
        { label:"好。我会准时到。", to:"n7_good" },
        { label:"我需要更多信息，否则免谈。", to:"n7_mid" },
        { label:"你在威胁我？", to:"n7_bad" }
      ]
    },

    n7_good: { speaker:"旁白", text:"你没有多说。你知道对这种人，态度本身就是语言。", add:{affection:+10, trust:+1}, next:"n8" },
    n7_mid:  { speaker:"旁白", text:"你保持距离，但没有关掉窗口。对方没有立刻回复。", add:{affection:+4}, next:"n8" },
    n7_bad:  { speaker:"旁白", text:"你打下那句话时，心里反而更清醒：你不想被任何人牵着走。", add:{affection:-7, trust:-1}, next:"n8" },

    n8: { speaker:"旁白", text:"夜色降下来。你推开门，看见他站在光里——像一座没有温度的雕像。", next:"n9" },

    n9: {
      speaker:"Doomfist",
      char:"assets/doomfist_calm.png",
      text:"回答我：你追求力量，还是追求安全？",
      choices:[
        { label:"力量。安全只是借口。", to:"q_power" },
        { label:"安全。力量会吞噬人。", to:"q_safe" },
        { label:"我追求的是选择权。", to:"q_choice" }
      ]
    },

    q_power: { speaker:"Doomfist", text:"诚实。\n我喜欢诚实的人。", add:{affection:+12, trust:+1}, next:"n10" },
    q_safe:  { speaker:"Doomfist", text:"谨慎。\n但谨慎往往意味着逃避。", add:{affection:-6, trust:-1}, next:"n10" },
    q_choice:{ speaker:"Doomfist", text:"选择权……\n你比我想象的更锋利。", add:{affection:+7}, next:"n10" },

    n10:{ speaker:"旁白", text:"他抬起那只沉重的拳套，停在你面前。\n不是攻击的距离，而是——试探。", next:"n11" },

    n11:{
      speaker:"Doomfist",
      char:"assets/doomfist_power.png",
      fx:{ bounce:true, shake:true },
      text:"握住它。\n你要么证明你配得上，要么现在就离开。",
      choices:[
        { label:"握住拳套：我不怕。", to:"end_check" },
        { label:"后退半步：我需要规则。", to:"end_check" },
        { label:"转身离开：我不玩你的游戏。", to:"end_leave" }
      ]
    },

    end_check:{
      speaker:"旁白",
      text:"你的指尖触到冰冷金属。\n那一刻你意识到：这不是恋爱游戏的开端。\n这是一次“契约”。",
      mail:{
        subject:"契约",
        content:"你以为握住的是拳套。\n其实你握住的是一条线——从此以后，你的每一次犹豫都会被记录。",
        sign:"—— 末日铁拳"
      },
      next:"end_eval"
    },

    end_eval:{ speaker:"系统", text:"（系统判定中……）", next:"end_branch" },
    end_branch:{ branch:true },

    // 分支：从 0 起步时，用阈值适配
    end_good:{
      speaker:"Doomfist",
      char:"assets/doomfist_calm.png",
      text:"很好。\n从今天起，你站在我这一侧。\n别让我失望。",
      end:"【好结局】铁拳的认可"
    },
    end_mid:{
      speaker:"Doomfist",
      char:"assets/doomfist_calm.png",
      text:"你还在犹豫。\n没关系——我会等你学会选择。",
      end:"【普通结局】临界点"
    },
    end_leave:{
      speaker:"旁白",
      text:"你离开时，背后没有脚步声追来。\n但你知道，那道目光一直在。\n你只是暂时逃过了它。",
      end:"【坏结局】拒绝契约"
    }
  }
};

/** =====================
 * 渲染
 * ===================== */
function clearChoices(){
  choicesEl.innerHTML = "";
  choicesEl.classList.add("hidden");
}

function showChoices(choices){
  choicesEl.innerHTML = "";
  choicesEl.classList.remove("hidden");
  choices.forEach((c)=>{
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = c.label;
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      goTo(c.to);
    });
    choicesEl.appendChild(btn);
  });
}

function applyNodeEffects(node){
  if (node.char){
    setCharacter(node.char, { bounce: !!node.fx?.bounce });
  }
  if (node.fx?.shake) screenShake();

  let affDelta = 0;
  if (node.add){
    for (const [k,delta] of Object.entries(node.add)){
      const before = Number(vars[k] ?? 0);
      vars[k] = before + Number(delta);
      if (k === "affection") affDelta += Number(delta);
    }
    // 不允许负数（你要允许负好感也行，把这行删掉）
    vars.affection = Math.max(0, vars.affection);
  }

  renderAffection(affDelta);

  unlockMailsByAffection();

  if (node.mail){
    deliverMail(node.mail);
  }
}

function render(){
  clearChoices();

  const node = STORY.nodes[nodeId];
  if (!node){
    speakerEl.textContent = "系统";
    textEl.textContent = "节点不存在：" + nodeId;
    return;
  }

  history.push(nodeId);

  // 分支判定（从 0 起步适配）
  if (node.branch){
    const good = (vars.affection >= 26 && vars.trust >= 1);
    nodeId = good ? "end_good" : "end_mid";
    render();
    return;
  }

  applyNodeEffects(node);

  speakerEl.textContent = node.speaker ?? "旁白";
  textEl.textContent = node.text ?? "";

  if (node.choices) showChoices(node.choices);

  if (node.end){
    textEl.textContent = (node.text ?? "") + "\n\n" + node.end + "\n（点击 RESET 重新开始）";
  }

  renderMailBadge();

  debugEl.textContent =
    `node=${nodeId} affection=${vars.affection} trust=${vars.trust} mode=${uiMode} unread=${countUnread()}`;
}

function canAdvance(){
  const node = STORY.nodes[nodeId];
  if (!node) return false;
  if (uiMode === "mail") return false;
  if (node.end) return false;
  if (node.choices && node.choices.length) return false;
  return true;
}

function advance(){
  const node = STORY.nodes[nodeId];
  if (!node || !node.next) return;
  nodeId = node.next;
  render();
}

function goTo(id){
  nodeId = id;
  render();
}

function goBack(){
  if (history.length < 2) return;
  history.pop();
  const prev = history.pop();
  if (!prev) return;
  nodeId = prev;
  render();
}

/** =====================
 * 存档/读档
 * ===================== */
function save(){
  const data = { nodeId, vars, history, mails, mailIndex };
  localStorage.setItem("vn_save", JSON.stringify(data));
}
function load(){
  const raw = localStorage.getItem("vn_save");
  if (!raw) return;
  try{
    const data = JSON.parse(raw);
    nodeId = data.nodeId ?? STORY.start;
    vars = data.vars ?? { affection:0, trust:0 };
    history = data.history ?? [];
    mails = data.mails ?? mails;
    mailIndex = data.mailIndex ?? 0;

    renderAffection(0);
    unlockMailsByAffection();
    renderMailBadge();
    if (uiMode === "mail") renderMailUI();
    render();
  }catch(e){}
}

/** =====================
 * 事件绑定
 * ===================== */
bg.addEventListener("click",(e)=>{ e.stopPropagation(); if (canAdvance()) advance(); });
textbox.addEventListener("click",(e)=>{ e.stopPropagation(); if (canAdvance()) advance(); });

btnReset.addEventListener("click",(e)=>{
  e.stopPropagation();
  nodeId = STORY.start;
  history = [];
  vars = { affection:0, trust:0 };
  initMails();
  unlockMailsByAffection();
  renderAffection(0);
  renderMailBadge();
  closeMail();
  render();
});

btnBack.addEventListener("click",(e)=>{ e.stopPropagation(); goBack(); });
btnSave.addEventListener("click",(e)=>{ e.stopPropagation(); save(); });
btnLoad.addEventListener("click",(e)=>{ e.stopPropagation(); load(); });

tabChat.addEventListener("click",(e)=>{ e.stopPropagation(); closeMail(); });
tabMail.addEventListener("click",(e)=>{ e.stopPropagation(); openMail(); });

mailClose.addEventListener("click",(e)=>{ e.stopPropagation(); closeMail(); });
mailPrev.addEventListener("click",(e)=>{ e.stopPropagation(); prevMail(); });
mailNext.addEventListener("click",(e)=>{ e.stopPropagation(); nextMail(); });
mailMarkRead.addEventListener("click",(e)=>{ e.stopPropagation(); markCurrentMailRead(); });

/** =====================
 * 启动
 * ===================== */
function boot(){
  initMails();
  unlockMailsByAffection();
  renderAffection(0);

  nodeId = STORY.start;
  tabChat.classList.add("active");
  closeMail();
  renderMailBadge();
  render();
}
boot();

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
