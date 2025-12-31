(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    bg: $("bg"),
    charImg: $("charImg"),
    speaker: $("speaker"),
    text: $("text"),
    hint: $("hint"),
    choices: $("choices"),

    btnChat: $("btnChat"),
    btnMail: $("btnMail"),
    btnReset: $("btnReset"),
    btnSave: $("btnSave"),
    btnLoad: $("btnLoad"),

    affVal: $("affVal"),
    trustVal: $("trustVal"),

    mailBadge: $("mailBadge"),
    mailPanel: $("mailPanel"),
    btnMailClose: $("btnMailClose"),
    mailList: $("mailList"),
    mailContent: $("mailContent"),

    textbox: $("textbox"),

    endingModal: $("endingModal"),
    endingBadge: $("endingBadge"),
    endingDesc: $("endingDesc"),
    btnRestart: $("btnRestart"),
    btnCloseEnding: $("btnCloseEnding"),
  };

  const LS_KEY = "vn_save_v2";

  let story = null;
  let state = {
    nodeId: null,
    vars: { affection: 0, trust: 0 },
    mailUnlocked: [],   // ids
    mailRead: [],       // ids
    ended: false,
  };

  function setError(msg) {
    els.speaker.textContent = "ERROR";
    els.text.textContent = msg;
    els.hint.textContent = "请检查 story.json / 资源路径";
    hideChoices();
  }

  function clampInt(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n);
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      toast("已存档");
    } catch (e) {
      toast("存档失败（浏览器限制）");
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);

      // 最小校验
      if (!obj || typeof obj !== "object") return false;
      state = {
        nodeId: obj.nodeId ?? story.start,
        vars: {
          affection: clampInt(obj.vars?.affection ?? 0),
          trust: clampInt(obj.vars?.trust ?? 0),
        },
        mailUnlocked: Array.isArray(obj.mailUnlocked) ? obj.mailUnlocked : [],
        mailRead: Array.isArray(obj.mailRead) ? obj.mailRead : [],
        ended: !!obj.ended,
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  function resetAll() {
    localStorage.removeItem(LS_KEY);
    state = {
      nodeId: story.start,
      vars: { ...story.vars },
      mailUnlocked: [],
      mailRead: [],
      ended: false,
    };
    render();
    toast("已重置");
  }

  function toast(msg) {
    // 简单提示：复用 hint
    const old = els.hint.textContent;
    els.hint.textContent = msg;
    setTimeout(() => (els.hint.textContent = old), 1200);
  }

  function showChoices(options) {
    els.choices.innerHTML = "";
    options.forEach((op) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = op.text;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        pick(op);
      });
      els.choices.appendChild(btn);
    });
    els.choices.classList.remove("hidden");
  }

  function hideChoices() {
    els.choices.classList.add("hidden");
    els.choices.innerHTML = "";
  }

  function updateHUD() {
    els.affVal.textContent = String(state.vars.affection ?? 0);
    els.trustVal.textContent = String(state.vars.trust ?? 0);

    const unread = state.mailUnlocked.filter((id) => !state.mailRead.includes(id)).length;
    if (unread > 0) {
      els.mailBadge.textContent = String(unread);
      els.mailBadge.classList.remove("hidden");
    } else {
      els.mailBadge.classList.add("hidden");
    }
  }

  function unlockMails(ids) {
    if (!Array.isArray(ids)) return;
    let changed = false;
    ids.forEach((id) => {
      if (!state.mailUnlocked.includes(id)) {
        state.mailUnlocked.push(id);
        changed = true;
      }
    });
    if (changed) {
      toast("收到新信件");
      updateHUD();
    }
  }

  function openMailPanel() {
    renderMailList();
    els.mailPanel.classList.remove("hidden");
  }

  function closeMailPanel() {
    els.mailPanel.classList.add("hidden");
  }

  function renderMailList() {
    els.mailList.innerHTML = "";
    const all = story.mails || [];
    const unlocked = all.filter((m) => state.mailUnlocked.includes(m.id));

    if (unlocked.length === 0) {
      els.mailContent.innerHTML = `<div class="mail-empty">暂无信件（会随剧情解锁）</div>`;
      return;
    }

    unlocked.forEach((m) => {
      const item = document.createElement("div");
      item.className = "mail-item" + (state.mailRead.includes(m.id) ? "" : " unread");
      item.innerHTML = `
        <div class="mail-from">${escapeHtml(m.from || "匿名")}</div>
        <div class="mail-subject">${escapeHtml(m.subject || "(无主题)")}</div>
      `;
      item.addEventListener("click", () => {
        openMail(m.id);
      });
      els.mailList.appendChild(item);
    });

    // 默认打开第一封
    openMail(unlocked[0].id);
  }

  function openMail(id) {
    const m = (story.mails || []).find((x) => x.id === id);
    if (!m) return;

    if (!state.mailRead.includes(id)) state.mailRead.push(id);

    els.mailContent.innerHTML = `
      <div style="font-weight:900; font-size:18px; margin-bottom:6px;">${escapeHtml(m.subject || "(无主题)")}</div>
      <div style="color:rgba(255,255,255,0.70); font-size:12px; margin-bottom:12px;">来自：${escapeHtml(m.from || "匿名")}</div>
      <div style="white-space:pre-wrap; line-height:1.65;">${escapeHtml(m.body || "")}</div>
    `;

    updateHUD();
    renderMailList(); // 刷新未读标识
    saveState();
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function applyDelta(delta) {
    if (!delta) return;
    if (typeof delta.affection === "number") state.vars.affection = clampInt((state.vars.affection || 0) + delta.affection);
    if (typeof delta.trust === "number") state.vars.trust = clampInt((state.vars.trust || 0) + delta.trust);
  }

  function goto(nodeId) {
    state.nodeId = nodeId;
    render();
  }

  function pick(option) {
    hideChoices();
    if (option.delta) applyDelta(option.delta);
    if (option.unlockMail) unlockMails(option.unlockMail);
    updateHUD();
    saveState();
    goto(option.next);
  }

  function showEnding(ending) {
    state.ended = true;
    saveState();

    els.endingBadge.textContent = `获得称号：${ending.badge || "——"}`;
    els.endingDesc.textContent = ending.desc || "";
    els.endingModal.classList.remove("hidden");
  }

  function closeEnding() {
    els.endingModal.classList.add("hidden");
  }

  function resolveGate(node) {
    // gate: [{var, op, value, next}, {else:true, next}]
    const gates = node.gate;
    if (!Array.isArray(gates)) return null;

    for (const g of gates) {
      if (g.else) return g.next;
      const v = Number(state.vars[g.var]);
      const t = Number(g.value);
      const op = g.op;

      let ok = false;
      if (op === ">=") ok = v >= t;
      else if (op === "<=") ok = v <= t;
      else if (op === ">") ok = v > t;
      else if (op === "<") ok = v < t;
      else if (op === "==") ok = v === t;

      if (ok) return g.next;
    }
    return null;
  }

  function render() {
    if (!story) return;

    const node = story.nodes?.[state.nodeId];
    if (!node) {
      setError(`找不到节点：${state.nodeId}（请检查 story.json 的 start / nodes）`);
      return;
    }

    // 背景/立绘
    if (node.bg) els.bg.style.backgroundImage = `url("${node.bg}")`;
    if (node.char) {
      els.charImg.src = node.char;
      els.charImg.style.opacity = "1";
    } else {
      els.charImg.style.opacity = "0";
    }

    // 文本
    els.speaker.textContent = node.speaker || "";
    els.text.textContent = node.text || "";
    els.hint.textContent = node.choices ? "请选择一个选项" : "点击对话框继续";

    // 解锁邮件
    if (node.unlockMail) unlockMails(node.unlockMail);

    // HUD
    updateHUD();

    // 结局
    if (node.ending) {
      hideChoices();
      showEnding(node.ending);
      return;
    } else {
      closeEnding();
      state.ended = false;
    }

    // Gate（条件跳转）
    const gatedNext = resolveGate(node);
    if (gatedNext) {
      // gate 节点不显示选择，点一下就跳
      hideChoices();
      state.nodeId = gatedNext;
      saveState();
      render();
      return;
    }

    // 选项
    if (node.choices && Array.isArray(node.choices) && node.choices.length > 0) {
      showChoices(node.choices);
    } else {
      hideChoices();
    }

    saveState();
  }

  function advance() {
    if (!story || state.ended) return;

    // 如果选项在，必须选，不能点继续
    const node = story.nodes?.[state.nodeId];
    if (!node) return;
    if (node.choices && node.choices.length) return;

    if (node.next) {
      goto(node.next);
    }
  }

  async function boot() {
    try {
      // 加个时间戳，减少 GitHub Pages 缓存带来的“改了不生效”
      const res = await fetch(`story.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`加载 story.json 失败：${res.status}`);
      story = await res.json();

      // 基本校验
      if (!story.start || !story.nodes) {
        throw new Error("story.json 缺少 start 或 nodes 字段");
      }
      story.vars = story.vars || { affection: 0, trust: 0 };
      story.mails = story.mails || [];

      // 初始化 state
      const loaded = loadState();
      if (!loaded) {
        state.nodeId = story.start;
        state.vars = { ...story.vars };
      } else {
        // 防止旧档指向不存在的节点
        if (!story.nodes[state.nodeId]) state.nodeId = story.start;
      }

      // 绑定事件
      els.textbox.addEventListener("click", advance);
      els.bg.addEventListener("click", advance);

      els.btnMail.addEventListener("click", openMailPanel);
      els.btnMailClose.addEventListener("click", closeMailPanel);

      els.btnChat.addEventListener("click", () => closeMailPanel());

      els.btnReset.addEventListener("click", () => {
        if (confirm("确定要重置进度吗？")) resetAll();
      });

      els.btnSave.addEventListener("click", saveState);
      els.btnLoad.addEventListener("click", () => {
        if (loadState()) {
          closeMailPanel();
          render();
          toast("已读档");
        } else {
          toast("没有存档");
        }
      });

      els.btnRestart.addEventListener("click", () => {
        closeEnding();
        resetAll();
      });

      els.btnCloseEnding.addEventListener("click", () => {
        closeEnding();
      });

      render();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  boot();
})();
