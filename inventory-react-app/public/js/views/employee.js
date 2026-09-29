window.Views = window.Views || {};
window.Views.employee = (function () {
  let scanner = null;
  let scannedProductId = null;

  function stopScanner() {
    if (scanner) {
      try {
        scanner.stop();
      } catch (e) {
        console.warn("Scanner stop failed", e);
      }
      scanner = null;
    }
    const region = document.getElementById("scanner-region");
    const toggle = document.getElementById("scanner-toggle");
    if (region) region.hidden = true;
    if (toggle) toggle.hidden = false;
  }

  function showScanResult(sku, product) {
    const result = document.getElementById("scan-result");
    const skuEl = document.getElementById("scan-sku");
    const nameEl = document.getElementById("scan-name");
    const stockForm = document.getElementById("scan-stock-form");
    const createBtn = document.getElementById("scan-create-btn");
    const createForm = document.getElementById("scan-create-form");
    if (!result || !skuEl || !nameEl) return;

    skuEl.textContent = UI.escape(sku);
    scannedProductId = product ? String(product.id) : "";

    if (product) {
      nameEl.textContent = UI.escape(product.name);
      if (stockForm) stockForm.dataset.id = scannedProductId;
      if (createBtn) createBtn.hidden = true;
      if (createForm) createForm.hidden = true;
    } else {
      nameEl.textContent = "Not found — create it";
      if (stockForm) stockForm.dataset.id = "";
      if (createBtn) createBtn.hidden = false;
      if (createForm) {
        createForm.hidden = false;
        const skuInput = createForm.querySelector('input[name="sku"]');
        if (skuInput) skuInput.value = sku;
      }
    }

    result.hidden = false;
  }

  function attachScanner() {
    const toggle = document.getElementById("scanner-toggle");
    const stopBtn = document.getElementById("scanner-stop");
    const createBtn = document.getElementById("scan-create-btn");
    const createCancel = document.getElementById("scan-create-cancel");

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (!window.Html5Qrcode) {
          UI.flash("Barcode scanner library not loaded.", "error");
          return;
        }
        toggle.hidden = true;
        const region = document.getElementById("scanner-region");
        if (region) region.hidden = false;
        const result = document.getElementById("scan-result");
        if (result) result.hidden = true;

        scanner = new Html5Qrcode("qr-reader");
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          function (decodedText) {
            UI.beep();
            const product = Store.searchProducts(decodedText).find(function (p) {
              return p.sku.toLowerCase() === decodedText.toLowerCase();
            });
            showScanResult(decodedText, product || null);
            stopScanner();
          },
          function () {}
        ).catch(function (err) {
          console.warn("Scanner start failed", err);
          UI.flash("Camera unavailable or permission denied.", "error");
          stopScanner();
        });
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener("click", function () {
        stopScanner();
      });
    }

    if (createBtn) {
      createBtn.addEventListener("click", function () {
        const createForm = document.getElementById("scan-create-form");
        if (createForm) createForm.hidden = false;
      });
    }

    if (createCancel) {
      createCancel.addEventListener("click", function () {
        const createForm = document.getElementById("scan-create-form");
        if (createForm) createForm.hidden = true;
      });
    }
  }

  async function dashboard(params, user) {
    const m = Store.metrics();
    const pending = Store.requests({ status: "pending" }).slice(0, 8);
    let html = await Templates.load("employee-dashboard");
    html = html.replace("{{pageHead}}", UI.pageHead(
      "Employee dashboard",
      "Receive stock, issue stock and clear requests.",
      '<a class="btn" href="#/employee/stock">Go to stock desk</a>'
    ));
    html = html.replace("<div data-insert=\"stat-1\"></div>", UI.stat(m.pendingRequests, "Pending requests", true));
    html = html.replace("<div data-insert=\"stat-2\"></div>", UI.stat(m.lowStockCount, "Low stock items"));
    html = html.replace("<div data-insert=\"stat-3\"></div>", UI.stat(m.totalUnits, "Units in stock"));
    html = html.replace("<div data-insert=\"stat-4\"></div>", UI.stat(m.productCount, "Products"));

    let queueHtml = "";
    if (pending.length) {
      queueHtml = UI.table(
        ["#", "Requester", "Item", "Qty", "In stock"],
        pending.map(function (r) {
          const product = Store.byId("products", r.productId);
          const requester = Store.byId("users", r.requesterId);
          const icon = product && product.imageUrl ? '<img src="' + UI.escape(product.imageUrl) + '" class="product-icon inline" alt=""> ' : (product && Store.productIcon(product) ? '<img src="' + Store.productIcon(product) + '" class="product-icon inline" alt=""> ' : "");
          return [
            String(r.id),
            UI.escape(requester ? requester.username : "?"),
            (icon ? icon : "") + UI.escape(product ? product.name : "deleted product"),
            String(r.quantity),
            String(product ? product.quantity : 0),
          ];
        })
      ) + '<p class="mt-12"><a href="#/employee/requests">Handle requests</a></p>';
    } else {
      queueHtml = UI.empty("Queue is clear.");
    }
    html = html.replace("<div data-insert=\"queue-table\"></div>", queueHtml);

    let reorderHtml = "";
    if (m.lowStock.length) {
      reorderHtml = UI.table(
        ["SKU", "Product", "Qty", "Reorder at"],
        m.lowStock.map(function (p) {
          const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
          return [
            UI.escape(p.sku),
            (icon ? icon : "") + UI.escape(p.name),
            String(p.quantity),
            String(p.reorderLevel),
          ];
        })
      );
    } else {
      reorderHtml = UI.empty("Nothing to reorder.");
    }
    html = html.replace("<div data-insert=\"reorder-table\"></div>", reorderHtml);

    html = html.replace("<div data-insert=\"movements-table\"></div>", UI.table(
      ["When", "Product", "Type", "Qty", "By", "Note"],
      Views.admin.movementRows(Store.movements(8, user.id))
    ));
    return html;
  }

  async function stock(params) {
    const query = params.q || "";
    const list = Store.searchProducts(query);
    let html = await Templates.load("employee-stock");
    html = html.replace("{{categoryOptions}}", '<option value="">Uncategorised</option>' + UI.selectOptions(Store.categories().map(function (category) {
      return { value: category.id, label: category.name };
    }), ""));
    html = html.replace("{{pageHead}}", UI.pageHead(
      "Stock desk",
      "Record goods in, goods out and stock counts.",
      '<form class="inline" data-action="search" data-route="#/employee/stock">' +
        '<input name="q" value="' + UI.escape(query) + '" placeholder="Search name or SKU" style="max-width:220px">' +
        '<button type="submit">Search</button></form>'
    ));
    html = html.replace("{{scanProductId}}", "");
    html = html.replace("<div data-insert=\"stock-table\"></div>", UI.table(
      ["SKU", "Product", "Location", "Qty", "Reorder", "Record movement", "Edit"],
      list.map(function (p) {
        const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
        return [
          UI.escape(p.sku),
          (icon ? icon : "") + UI.escape(p.name) + (Store.isLowStock(p) ? " " + UI.badge("low", true) : ""),
          UI.escape(p.location || "—"),
          String(p.quantity),
          String(p.reorderLevel),
          Views.admin.stockForm(p.id, ["In", "Out", "Count"]),
          Views.admin.editCell(p, { allowDelete: false }),
        ];
      })
    ));
    return html;
  }

  async function requests(params) {
    const status = params.status === undefined ? "pending" : params.status;
    const rows = Views.admin.requestRows(Store.requests({ status: status }), { actions: true });
    let html = await Templates.load("employee-requests");
    html = html.replace("{{pageHead}}", UI.pageHead(
      "Requests",
      "Approve, reject or fulfil user requests.",
      '<form class="inline" data-action="filter" data-route="#/employee/requests">' +
        '<select name="status" class="w-auto"><option value="">All statuses</option>' +
        UI.selectOptions(Store.STATUSES, status) +
        '</select><button type="submit">Filter</button></form>'
    ));
    html = html.replace("<div data-insert=\"requests-table\"></div>", UI.table(
      ["#", "Raised", "Requester", "Item", "Qty", "Reason", "Status", "Handled by", "Actions"],
      rows
    ));
    return html;
  }

  async function chat(params, user) {
    let html = await Templates.load("chat");
    html = html.replace("{{pageHead}}", UI.pageHead("Chat", "Team communication."));
    const senders = await Chat.listSenders(user.id);
    const firstSender = senders[0];
    const sendersHtml = senders.length === 0
      ? '<p class="muted">No direct conversations yet.</p>'
      : senders.map(function (sender) {
        return '<button type="button" class="sender-list-item' + (firstSender && sender.id === firstSender.id ? " active" : "") + '" data-chat-contact="' + UI.escape(sender.id) + '" data-chat-name="' + UI.escape(sender.name) + '" data-current-user-id="' + user.id + '"><span class="sender-avatar">' + UI.escape((sender.name || "?").charAt(0).toUpperCase()) + '</span><span class="sender-info"><strong>' + UI.escape(sender.name) + '</strong><span class="muted">' + UI.escape(sender.lastText || sender.role) + '</span></span></button>';
      }).join("");
    html = html.replace('<div class="sender-list" data-insert="chat-senders"></div>', '<div class="sender-list" data-insert="chat-senders">' + sendersHtml + '</div>');
    if (firstSender) {
      html = html.replace('<div id="chat-active-name" class="chat-active-name">Select a conversation</div>', '<div id="chat-active-name" class="chat-active-name">' + UI.escape(firstSender.name) + '</div>');
      html = html.replace('<div id="chat-messages" class="chat-messages"></div>', '<div id="chat-messages" class="chat-messages" data-conversation-id="' + firstSender.id + '"></div>');
      html = html.replace('<form id="chat-form" class="chat-form" data-action="chat-send">', '<form id="chat-form" class="chat-form" data-action="chat-send" data-recipient-id="' + firstSender.id + '">');
    }
    Chat.stop();
    Chat.listen(function (msg) {
      appendChatMessage(msg, user);
      if (typeof Chat.refreshSenderList === "function") {
        Chat.refreshSenderList(user.id);
      }
      if (String(msg.senderId) !== String(user.id) && msg.status !== "read" && msg.id) {
        Chat.updateStatus(msg.id, "read");
      }
    }, user.id);
    Chat.markAllRead(user.id);
    return html;
  }

  function appendChatMessage(msg, user) {
    var container = document.getElementById("chat-messages");
    if (!container) return;
    var existing = msg.id ? container.querySelector('[data-message-id="' + msg.id + '"]') : null;
    if (existing) {
      updateChatStatus(existing, msg.status);
      return;
    }
    var div = document.createElement("div");
    var isMine = String(msg.senderId) === String(user.id);
    div.className = "chat-message " + (isMine ? "sent" : "received");
    div.setAttribute("data-message-id", msg.id || "");
    div.dataset.senderId = msg.senderId || "";
    div.dataset.recipientId = msg.recipientId || "";
    div.hidden = !Chat.matchesConversation(msg, container.dataset.conversationId, user.id);
    var statusClass = chatStatusClass(msg.status);
    var statusHtml = isMine ? '<div class="chat-status ' + statusClass + '">' + chatStatusIcon(msg.status) + "</div>" : "";
    div.innerHTML =
      '<div class="chat-meta">' +
      '<strong>' + UI.escape(msg.senderName) + '</strong>' +
      '<span class="muted">' + UI.escape(msg.senderRole) + '</span>' +
      '<span class="muted">' + UI.datetime(msg.timestamp) + "</span>" +
      "</div>" +
      '<div class="chat-text">' + UI.escape(msg.text) + "</div>" +
      statusHtml;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function updateChatStatus(div, status) {
    var statusElement = div.querySelector(".chat-status");
    if (!statusElement) return;
    statusElement.className = "chat-status " + chatStatusClass(status);
    statusElement.innerHTML = chatStatusIcon(status);
  }

  function chatStatusClass(status) {
    return status === "delivered" || status === "read" ? status : "sent";
  }

  function chatStatusIcon(status) {
    if (status === "read") {
      return '<span class="ticks ticks-double ticks-read">&#10003;&#10003;</span>';
    }
    if (status === "delivered") {
      return '<span class="ticks ticks-double">&#10003;&#10003;</span>';
    }
    return '<span class="ticks ticks-single">&#10003;</span>';
  }

  function initScanner() {
    attachScanner();
  }

  return { dashboard: dashboard, stock: stock, requests: requests, chat: chat, initScanner: initScanner, stopScanner: stopScanner };
})();
