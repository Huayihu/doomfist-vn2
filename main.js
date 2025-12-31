(() => {
  const LS_KEY = "vn_state_v2";

  const els = {
    bg: document.getElementById("bg"),
    charImg: document.getElementById("charImg"),
    speaker: document.getElementById("speaker"),
    text: document.getElementById("text"),
    hint: document.getElementById("hint"),
    textbox: document.getElementById("textbox"),
    choices: document.getElementById("choices"),

    affVal: document.getElementById("affVal"),
    trustVal: document.getElementById("trustVal"),

    btnChat: document.getElementById("btnChat"),
    btnMail: document.getElementById("btnMail"),
    btnReset: document.getElementById("btnReset"),

    chatPanel: document.getElementById("chatPanel"),
    chatLog: document.getElementById("chatLog"),
    btnChatClose: document.getElementById("btnChatClose"),

    mailPanel: document.getElementById("mailPanel"),
    mailList: document.getElementById("mailList"),
    mailViewTitle: document.getElementById("mailViewTitle"),
    mailViewMeta: document.getElementById("mailViewMeta"),
    mailViewBody: document.getElementById("mailViewBody"),
    btnMailClose: document.getElementById("btnMailClose"),
    mailBadge: document.getElementById("mailBadge"),

    toast: document.getElementById("toast"),

    endingModal: document.getElementById("endingModal"),
    endingTitle: document.getElementById("endingTitle"),
    endingBadge: document.getElementById("endingBadge"),
    btnRestart: document.getElementById("btnRestart"),
    btnCloseEnding: document.getElementById("btnCloseEnding"),
  };

  /** @type {{start:string,nodes:Object<string,any>,mails?:Object<string,any>}} */
  let STORY = null;

  let state = {
    nodeId: null,
    affection: 0,
    trust: 0,
    // 当前显示（用于继承）
    currentBg: null,
    currentChar: null,

    // 历史记录
    history: [], // [{speaker,text}]

    // 信件
    mailbox: {
      unlocked: [], // ["m01","m02"...]
      read: []      // ["m01"...]
    }
  };

  function safeParse(jsonStr) {
    try { return JSON.parse(jsonStr); } catch { return null; }
  }

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function load() {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? safeParse(raw) : null;
    if (obj && typeof obj === "object") {
      // 合并字段，避免旧存档缺字段
      state = {
        ...state,
        ...obj,
        mailbox: {
          unlocked: Array.isArray(obj?.mailbox?.unlocked) ? obj.mailbox.unlocked : [],
          read: Array.isArray(obj?.mailbox?.read) ? obj.mailbox.read : [],
        }
      };
    }
  }

  function resetAll() {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }

  function showToast(msg = "收到新信件") {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    setTimeout(() => els.toast.classList.add("hidden"), 1500);
  }

  function clampInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.trunc(x);
  }

  function applyDelta(nodeOrChoice) {
    if (!nodeOrChoice) return;
    state.affection += clampInt(nodeOrChoice.affectionDelta || 0);
    state.trust += clampInt(nodeOrChoice.trustDelta || 0);
  }

  function addHistory(speaker, text) {
    if (!text) return;
    state.history.push({ speaker: speaker || "旁白", text });
    if (state.history.length > 60) state.history.shift();
  }

  function isUnlocked(mailId) {
    return state.mailbox.unlocked.includes(mailId);
  }
  function isRead(mailId) {
    return state.mailbox.read.includes(mailId);
  }
  function markRead(mailId) {
    if (!isRead(mailId)) state.mailbox.read.push(mailId);
  }
  function unlockMail(mailId) {
    if (!mailId) return;
    if (!STORY?.mails?.[mailId]) return; // story里没有定义就忽略
    if (!isUnlocked(mailId)) {
      state.mailbox.unlocked.push(mailId);
      showToast("收到新信件");
    }
  }

  function unreadCount() {
    return state.mailbox.unlocked.filter(id => !isRead(id)).length;
  }

  function updateMailBadge() {
    const n = unreadCount();
    if (n > 0) {
      els.mailBadge.textContent = String(n);
      els.mailBadge.classList.remove("hidden");
    } else {
      els.mailBadge.classList.add("hidden");
    }
  }

  function renderChatLog() {
    els.chatLog.innerHTML = "";
    const frag = document.createDocumentFragment();
    state.history.slice(-40).forEach(item => {
      const div = document.createElement("div");
      div.className = "log-item";
      div.innerHTML = `<span class="who">${escapeHtml(item.speaker)}：</span>${escapeHtml(item.text)}`;
      frag.appendChild(div);
    });
    els.chatLog.appendChild(frag);
    els.chatLog.scrollTop = els.chatLog.scrollHeight;
  }

  function renderMailList() {
    els.mailList.innerHTML = "";
    const ids = state.mailbox.unlocked.slice().reverse(); // 新的在前
    if (ids.length === 0) {
      els.mailList.innerHTML = `<div style="opacity:.8;font-size:14px;">暂无信件（在剧情节点/选项中解锁）</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    ids.forEach(id => {
      const m = STORY.mails[id];
      const item = document.createElement("div");
      item.className = "mail-item" + (!isRead(id) ? " unread" : "");
      const from = m.from ? `来自：${m.from}` : "";
      item.innerHTML = `<div class="t">${escapeHtml(m.title || id)}</div><div class="m">${escapeHtml(from)}</div>`;
      item.addEventListener("click", () => openMail(id));
      frag.appendChild(item);
    });
    els.mailList.appendChild(frag);
  }

  function openMail(id) {
    const m = STORY.mails[id];
    if (!m) return;
    markRead(id);
    updateMailBadge();
    save();

    els.mailViewTitle.textContent = m.title || id;
    els.mailViewMeta.textContent = (m.from ? `来自：${m.from}` : "") + (m.date ? `  ·  ${m.date}` : "");
    els.mailViewBody.textContent = m.body || "";
    // 刷新列表的未读样式
    renderMailList();
  }

  function openPanel(panelEl) {
    panelEl.classList.remove("hidden");
  }
  function closePanel(panelEl) {
    panelEl.classList.add("hidden");
  }

  function openEnding(title, badge) {
    els.endingTitle.textContent = title || "游戏结束";
    els.endingBadge.textContent = badge || "称号";
    els.endingModal.classList.remove("hidden");
  }
  function closeEnding() {
    els.endingModal.classList.add("hidden");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setNode(id) {
    if (!STORY.nodes[id]) {
      // 找不到节点：直接报错到对话框
      els.speaker.textContent = "ERROR";
      els.text.textContent = `找不到节点：${id}`;
      els.choices.classList.add("hidden");
      save();
      return;
    }
    state.nodeId = id;
    render();
    save();
  }

  function render() {
    const node = STORY.nodes[state.nodeId];

    // 先应用节点本身的增量（进入节点就加）
    // 注意：只在“首次进入”时加更合理，但为了简单可控，
    // 我们用一个节点访问标记避免重复加
    if (!node._visited) {
      node._visited = true;
      applyDelta(node);
      if (node.mailAdd) unlockMail(node.mailAdd);
    }

    // 背景：只有显式提供 bg 才切换，否则继承
    if ("bg" in node) {
      state.currentBg = node.bg || state.currentBg;
    }
    if (state.currentBg) {
      els.bg.style.backgroundImage = `url("${state.currentBg}")`;
    }

    // 立绘：只有显式提供 char 才切换/隐藏，否则继承
    if ("char" in node) {
      if (node.char) {
        state.currentChar = node.char;
        els.charImg.src = state.currentChar;
        els.charImg.style.opacity = "1";
      } else {
        // 显式隐藏
        els.charImg.style.opacity = "0";
      }
    } else {
      // 继承
      if (state.currentChar) {
        els.charImg.src = state.currentChar;
        els.charImg.style.opacity = "1";
      }
    }

    // 文本
    const sp = node.speaker || "旁白";
    const tx = node.text || "";
    els.speaker.textContent = sp;
    els.text.textContent = tx;

    // 加入历史记录（避免空文本）
    addHistory(sp, tx);
    updateStatsUI();

    // 选项
    if (Array.isArray(node.choices) && node.choices.length > 0) {
      renderChoices(node.choices);
      els.choices.classList.remove("hidden");
      els.hint.textContent = "请选择一个选项";
    } else {
      els.choices.classList.add("hidden");
      els.hint.textContent = "点击对话框继续";
    }

    // 结局
    if (node.end) {
      // end: { title, badge }
      openEnding(node.end.title || "游戏结束", node.end.badge || "称号");
    }

    // 邮箱红点
    updateMailBadge();
  }

  function updateStatsUI() {
    els.affVal.textContent = String(state.affection);
    els.trustVal.textContent = String(state.trust);
  }

  function renderChoices(choices) {
    els.choices.innerHTML = "";
    const frag = document.createDocumentFragment();

    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c.text || "（未命名选项）";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();

        // 选项增量
        applyDelta(c);
        if (c.mailAdd) unlockMail(c.mailAdd);

        // 进下一节点
        if (c.next) {
          setNode(c.next);
        }
      });
      frag.appendChild(btn);
    });

    els.choices.appendChild(frag);
  }

  function advance() {
    const node = STORY.nodes[state.nodeId];
    // 有选项则不允许点对话框推进（避免误触）
    if (Array.isArray(node.choices) && node.choices.length > 0) return;

    if (node.next) {
      setNode(node.next);
      return;
    }

    // 没有 next：提示已到末尾
    els.speaker.textContent = "系统";
    els.text.textContent = "已到达当前分支末尾。你可以点击 RESET 重新开始。";
  }

  async function init() {
    // 加载 story.json
    let story;
    try {
      const res = await fetch("story.json", { cache: "no-store" });
      story = await res.json();
    } catch (e) {
      els.speaker.textContent = "ERROR";
      els.text.textContent = "story.json 加载失败：请检查文件是否存在、是否为合法 JSON。";
      console.error(e);
      return;
    }

    // 校验
    if (!story || typeof story !== "object" || !story.start || !story.nodes) {
      els.speaker.textContent = "ERROR";
      els.text.textContent = "story.json 缺少 start 或 nodes 字段";
      return;
    }
    STORY = story;
    if (!STORY.mails) STORY.mails = {};

    // 读档
    load();

    // 初始化默认背景/立绘（避免空白）
    if (!state.currentBg) state.currentBg = "assets/bg.png";
    if (!state.currentChar) state.currentChar = "assets/charB.png";

    // 如果没节点，就从 start 开始
    if (!state.nodeId) state.nodeId = STORY.start;

    // 绑定事件
    els.textbox.addEventListener("click", () => advance());

    els.btnReset.addEventListener("click", resetAll);

    // 聊天记录按钮
    els.btnChat.addEventListener("click", () => {
      renderChatLog();
      openPanel(els.chatPanel);
    });
    els.btnChatClose.addEventListener("click", () => closePanel(els.chatPanel));

    // 信件按钮
    els.btnMail.addEventListener("click", () => {
      renderMailList();
      openPanel(els.mailPanel);
      updateMailBadge();
      save();
    });
    els.btnMailClose.addEventListener("click", () => closePanel(els.mailPanel));

    // 结局
    els.btnRestart.addEventListener("click", resetAll);
    els.btnCloseEnding.addEventListener("click", closeEnding);
    els.endingModal.addEventListener("click", (e) => {
      if (e.target === els.endingModal) closeEnding();
    });

    // 首次渲染
    // 重要：清掉 nodes 的 _visited 标记（从 JSON 读入可能残留？这里确保每次刷新都是干净的）
    Object.values(STORY.nodes).forEach(n => { if (n && typeof n === "object") delete n._visited; });

    render();
    save();
  }

  init();
})();
