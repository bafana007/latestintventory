window.Views = window.Views || {};
window.Views.admin = (function () {
  function movementRows(list) {
    return list.map(function (m) {
      const product = Store.byId("products", m.productId);
      const actor = m.userId ? Store.byId("users", m.userId) : null;
      return [
        '<span class="muted">' + UI.datetime(m.createdAt) + "</span>",
        product ? '<a href="#/admin/products">' + UI.escape(product.name) + "</a>" : UI.escape("deleted product"),
        UI.badge(m.type),
        String(m.quantity),
        UI.escape(actor ? actor.username : "system"),
        '<span class="muted">' + UI.escape(m.note) + "</span>",
      ];
    });
  }

  function requestRows(list, options) {
    options = options || {};
    return list.map(function (r) {
      const product = Store.byId("products", r.productId);
      const requester = Store.byId("users", r.requesterId);
      const handler = r.handledById ? Store.byId("users", r.handledById) : null;
      const icon = product && product.imageUrl ? '<img src="' + UI.escape(product.imageUrl) + '" class="product-icon inline" alt=""> ' : (product && Store.productIcon(product) ? '<img src="' + Store.productIcon(product) + '" class="product-icon inline" alt=""> ' : "");
      const cells = [
        String(r.id),
        '<span class="muted">' + UI.datetime(r.createdAt) + "</span>",
        UI.escape(requester ? requester.fullName : "unknown") +
          '<div class="muted">@' +
          UI.escape(requester ? requester.username : "?") +
          "</div>",
        (product ? '<a href="#/admin/products">' + (icon ? icon : "") + UI.escape(product.name) + '</a><div class="muted">' + UI.escape(product.sku) + "</div>" : UI.escape("deleted product") + '<div class="muted">—</div>'),
        String(r.quantity),
        '<span class="muted">' + UI.escape(r.reason) + "</span>",
        UI.badge(r.status, r.status === "pending"),
        UI.escape(handler ? handler.username : "—"),
      ];
      if (options.actions) {
        cells.push(actionsCell(r));
      }
      return cells;
    });
  }

  function actionsCell(r) {
    if (r.status !== "pending" && r.status !== "approved") {
      return '<span class="muted">closed</span>';
    }
    return (
      '<form class="inline" data-action="handle-request" data-id="' +
      r.id +
      '" data-op="approve"><button class="small" type="submit"' +
      (r.status === "approved" ? " disabled" : "") +
      ">Approve</button></form>" +
      '<form class="inline" data-action="handle-request" data-id="' +
      r.id +
      '" data-op="fulfill"><button class="small" type="submit">Fulfil</button></form>' +
      '<form class="inline" data-action="handle-request" data-id="' +
      r.id +
      '" data-op="reject"><button class="small ghost" type="submit">Reject</button></form>'
    );
  }

  async function dashboard() {
    const m = Store.metrics();
    const roleOptions = Store.ROLES;
    const allRequests = Store.requests();
    const recentUsers = Store.users().slice(0, 5);
    const allProducts = Store.searchProducts("");
    const movements = Store.movements(50);

    let html = await Templates.load("admin-dashboard");
    html = html.replace("{{pageHead}}", UI.pageHead("Admin dashboard", "Full control over stock, people, orders and reports."));
    html = html.replace("{{roleOptions}}", UI.selectOptions(roleOptions, "user"));
    html = html.replace("{{categoryOptions}}", categoryOptions(""));

    html = html.replace("<div data-insert=\"stat-1\"></div>", UI.stat(m.productCount, "Products", true));
    html = html.replace("<div data-insert=\"stat-2\"></div>", UI.stat(m.totalUnits, "Units in stock"));
    html = html.replace("<div data-insert=\"stat-3\"></div>", UI.stat(UI.money(m.stockValue), "Stock value"));
    html = html.replace("<div data-insert=\"stat-4\"></div>", UI.stat(m.lowStockCount, "Low stock items"));
    html = html.replace("<div data-insert=\"stat-5\"></div>", UI.stat(m.pendingRequests, "Pending requests"));
    html = html.replace("<div data-insert=\"stat-6\"></div>", UI.stat(m.userCount, "Accounts"));

    html = html.replace("<div data-insert=\"users-table\"></div>", UI.table(
      ["User", "Role", "Status", "Actions"],
      recentUsers.map(function (u) {
        return [
          UI.escape(u.fullName) + '<div class="muted">@' + UI.escape(u.username) + "</div>",
          '<form class="inline" data-action="set-role" data-id="' +
            u.id +
            '"><select name="role" class="w-auto">' +
            UI.selectOptions(roleOptions, u.role) +
            '</select><button class="small" type="submit">Set</button></form>',
          u.isActive ? "active" : "disabled",
          '<form class="inline" data-action="toggle-user" data-id="' +
            u.id +
            '"><button class="small ghost" type="submit">' +
            (u.isActive ? "Deactivate" : "Activate") +
            "</button></form>",
        ];
      })
    ));

    html = html.replace("<div data-insert=\"stock-levels-table\"></div>", UI.table(
      ["SKU", "Product", "Qty", "Reorder", "Value", "Status", ""],
      allProducts.slice(0, 8).map(function (p) {
        const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
        return [
          '<a href="#/admin/products">' + UI.escape(p.sku) + "</a>",
          (icon ? icon : "") + '<a href="#/admin/products">' + UI.escape(p.name) + "</a>",
          String(p.quantity),
          String(p.reorderLevel),
          UI.money(Store.stockValue(p)),
          UI.badge(p.quantity === 0 ? "out of stock" : p.quantity <= p.reorderLevel ? "low" : "ok", p.quantity === 0 || p.quantity <= p.reorderLevel),
          editCell(p),
        ];
      })
    ));

    html = html.replace("<div data-insert=\"all-orders-table\"></div>", UI.table(
      ["#", "Raised", "Requester", "Item", "Qty", "Reason", "Status", "Handled by", "Actions"],
      requestRows(allRequests, { actions: true })
    ));

    html = html.replace("<div data-insert=\"valuation-table\"></div>", UI.table(
      ["SKU", "Product", "Category", "Qty", "Unit price", "Value"],
      allProducts.map(function (p) {
        const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
        return [
          '<a href="#/admin/products">' + UI.escape(p.sku) + "</a>",
          (icon ? icon : "") + '<a href="#/admin/products">' + UI.escape(p.name) + "</a>",
          UI.escape(Store.categoryName(p) || "—"),
          String(p.quantity),
          UI.money(p.unitPrice),
          UI.money(Store.stockValue(p)),
        ];
      })
    ));

    html = html.replace("<div data-insert=\"system-activity-table\"></div>", UI.table(
      ["When", "Product", "Type", "Qty", "By", "Note"],
      movementRows(movements)
    ));

    return html;
  }

  async function products(params) {
    const query = params.q || "";
    const list = Store.searchProducts(query);
    let html = await Templates.load("admin-products");
    html = html.replace("{{pageHead}}", UI.pageHead(
      "Products",
      list.length + " item(s)",
      '<form class="inline" data-action="search" data-route="#/admin/products">' +
        '<input name="q" value="' + UI.escape(query) + '" placeholder="Search name or SKU" style="max-width:220px">' +
        '<button type="submit">Search</button></form>'
    ));
    html = html.replace("{{categoryOptions}}", categoryOptions(""));
    html = html.replace("<div data-insert=\"products-table\"></div>", UI.table(
      [
        "SKU",
        "Name",
        "Category",
        "Qty",
        "Reorder",
        "Price",
        "Value",
        "Location",
        "Stock action",
        "",
      ],
      list.map(function (p) {
        const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
        return [
          UI.escape(p.sku),
          (icon ? icon : "") + '<a href="#/admin/products">' + UI.escape(p.name) + "</a>" + (Store.isLowStock(p) ? " " + UI.badge("low", true) : ""),
          UI.escape(Store.categoryName(p) || "—"),
          String(p.quantity),
          String(p.reorderLevel),
          UI.money(p.unitPrice),
          UI.money(Store.stockValue(p)),
          UI.escape(p.location || "—"),
          stockForm(p.id, ["In", "Out", "Set"]),
          editCell(p),
        ];
      })
    ));
    return html;
  }

  async function categories() {
    let html = await Templates.load("admin-categories");
    html = html.replace("{{pageHead}}", UI.pageHead("Categories", "Group products for reporting."));
    html = html.replace("<div data-insert=\"categories-table\"></div>", UI.table(
      ["Name", "Description", "Products"],
      Store.categories().map(function (c) {
        return [
          UI.escape(c.name),
          '<span class="muted">' + UI.escape(c.description) + "</span>",
          String(Store.productsInCategory(c.id).length),
        ];
      })
    ));
    return html;
  }

  async function users() {
    const roleOptions = Store.ROLES;
    let html = await Templates.load("admin-users");
    html = html.replace("{{pageHead}}", UI.pageHead("Users", Store.users().length + " account(s) across all portals."));
    html = html.replace("{{roleOptions}}", UI.selectOptions(roleOptions, "user"));
    html = html.replace("<div data-insert=\"access-requests-table\"></div>", UI.table(
      ["User", "Requested access", "Submitted", "Status", "Action"],
      Store.accessRequests().map(function (request) {
        const requester = Store.byId("users", request.userId);
        return [
          UI.escape(requester ? requester.fullName : "Unknown user") + '<div class="muted">' + UI.escape(requester ? requester.email : "") + "</div>",
          UI.badge(request.requestedRole),
          '<span class="muted">' + UI.datetime(request.createdAt) + "</span>",
          UI.badge(request.status, request.status === "pending"),
          request.status === "pending" ? '<form class="inline" data-action="handle-access-request" data-id="' + request.id + '"><button class="small" name="accessAction" value="approve" type="submit">Approve</button><button class="small ghost" name="accessAction" value="reject" type="submit">Reject</button></form>' : "",
        ];
      })
    ));
    const userCards = Store.users().map(function (u) {
      return '<article class="user-card">' +
        '<div class="user-card-main"><h3>' + UI.escape(u.fullName) + '</h3>' +
        '<div class="muted">@' + UI.escape(u.username) + '</div>' +
        '<div class="muted">' + UI.escape(u.email) + '</div></div>' +
        '<div class="user-card-meta"><span>Role ' + UI.badge(u.role) + '</span><span>Status ' + UI.badge(u.isActive ? "active" : "disabled", !u.isActive) + '</span><span class="muted">Joined ' + UI.day(u.createdAt) + '</span></div>' +
        '<div class="user-card-actions"><form class="inline" data-action="set-role" data-id="' + u.id + '"><select name="role" class="w-auto">' + UI.selectOptions(roleOptions, u.role) + '</select><button class="small" type="submit">Set role</button></form>' +
        '<form class="inline" data-action="toggle-user" data-id="' + u.id + '"><button class="small ghost" type="submit">' + (u.isActive ? "Deactivate" : "Activate") + '</button></form></div>' +
        '</article>';
    }).join("");
    html = html.replace("<div data-insert=\"users-table\"></div>", '<div class="user-stack">' + (userCards || UI.empty("No users found.")) + "</div>");
    return html;
  }

  async function requests(params) {
    const status = params.status || "";
    let html = await Templates.load("admin-requests");
    html = html.replace("{{pageHead}}", UI.pageHead(
      "Requests",
      "Every request raised in the user portal.",
      '<form class="inline" data-action="filter" data-route="#/admin/requests">' +
        '<select name="status" class="w-auto"><option value="">All statuses</option>' +
        UI.selectOptions(Store.STATUSES, status) +
        '</select><button type="submit">Filter</button></form>'
    ));
    html = html.replace("<div data-insert=\"requests-table\"></div>", UI.table(
      ["#", "Raised", "Requester", "Item", "Qty", "Reason", "Status", "Handled by"],
      requestRows(Store.requests({ status: status }))
    ));
    return html;
  }

  async function reports() {
    const m = Store.metrics();
    let html = await Templates.load("admin-reports");
    html = html.replace("{{pageHead}}", UI.pageHead("Reports", "Valuation, reorder list and the full movement ledger."));
    html = html.replace("<div data-insert=\"stat-1\"></div>", UI.stat(UI.money(m.stockValue), "Total stock value", true));
    html = html.replace("<div data-insert=\"stat-2\"></div>", UI.stat(m.totalUnits, "Units held"));
    html = html.replace("<div data-insert=\"stat-3\"></div>", UI.stat(m.lowStockCount, "Need reorder"));
    html = html.replace("<div data-insert=\"stat-4\"></div>", UI.stat(m.pendingRequests, "Open requests"));
    html = html.replace("<div data-insert=\"valuation-table\"></div>", UI.table(
      ["SKU", "Product", "Category", "Qty", "Unit price", "Value"],
      Store.searchProducts("").map(function (p) {
        const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon inline" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon inline" alt=""> ' : "");
        return [
          UI.escape(p.sku),
          (icon ? icon : "") + UI.escape(p.name),
          UI.escape(Store.categoryName(p) || "—"),
          String(p.quantity),
          UI.money(p.unitPrice),
          UI.money(Store.stockValue(p)),
        ];
      })
    ));
    html = html.replace("<div data-insert=\"movement-ledger-table\"></div>", UI.table(
      ["When", "Product", "Type", "Qty", "By", "Note"],
      movementRows(Store.movements(100))
    ));
    return html;
  }

  function stockForm(productId, labels) {
    return (
      '<form class="inline" data-action="stock-move" data-id="' +
      productId +
      '">' +
      '<select name="type" class="w-auto">' +
      UI.selectOptions([
        { value: "in", label: labels[0] },
        { value: "out", label: labels[1] },
        { value: "adjust", label: labels[2] },
      ]) +
      "</select>" +
      '<input name="quantity" type="number" value="1" min="0" style="max-width:80px">' +
      '<input name="note" placeholder="Note" style="max-width:120px">' +
      '<button class="small" type="submit">Apply</button></form>'
    );
  }

  function categoryOptions(selected) {
    return (
      '<option value="">Uncategorised</option>' +
      UI.selectOptions(
        Store.categories().map(function (c) {
          return { value: c.id, label: c.name };
        }),
        selected
      )
    );
  }

  function editCell(p, options) {
    options = options || {};
    const icon = p.imageUrl ? '<img src="' + UI.escape(p.imageUrl) + '" class="product-icon" alt=""> ' : (Store.productIcon(p) ? '<img src="' + Store.productIcon(p) + '" class="product-icon" alt=""> ' : "");
    return (
      "<details><summary>Edit</summary>" +
      (icon ? '<div class="mt-12">' + icon + '</div>' : "") +
      '<form data-action="edit-product" data-id="' +
      p.id +
      '" class="mt-8" style="min-width:260px">' +
      '<div class="field"><label>Name</label><input name="name" value="' +
      UI.escape(p.name) +
      '" required></div>' +
      '<div class="field"><label>Description</label><input name="description" value="' +
      UI.escape(p.description) +
      '"></div>' +
      '<div class="field"><label>Category</label><select name="categoryId">' +
      categoryOptions(p.categoryId) +
      "</select></div>" +
      '<div class="field"><label>Reorder level</label><input name="reorderLevel" type="number" value="' +
      p.reorderLevel +
      '"></div>' +
      '<div class="field"><label>Unit price</label><input name="unitPrice" type="number" step="0.01" value="' +
      p.unitPrice +
      '"></div>' +
      '<div class="field"><label>Location</label><input name="location" value="' +
      UI.escape(p.location) +
      '"></div>' +
      '<button class="small" type="submit">Save</button></form>' +
      '<form data-action="upload-product-image" data-id="' +
      p.id +
      '" class="mt-8" enctype="multipart/form-data">' +
      '<div class="field"><label>Image</label><input type="file" name="image" accept="image/*"></div>' +
      '<button class="small" type="submit">Upload image</button></form>' +
      (options.allowDelete === false ? "" : '<form data-action="delete-product" data-id="' +
      p.id +
      '" data-sku="' +
      UI.escape(p.sku) +
      '" class="mt-8">' +
      '<button class="small ghost" type="submit">Delete</button></form>') + "</details>"
    );
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

  return {
    dashboard: dashboard,
    products: products,
    categories: categories,
    users: users,
    requests: requests,
    reports: reports,
    chat: chat,
    movementRows: movementRows,
    requestRows: requestRows,
    stockForm: stockForm,
    editCell: editCell,
  };
})();
