/* Chat data layer using Firebase Realtime Database. */
window.Chat = (function () {
  function getRef() {
    if (!window.FirebaseDB) {
      console.error("FirebaseDB not initialized");
      return null;
    }
    return window.FirebaseDB.ref("chats/messages");
  }

  var listeners = [];
  var listening = false;
  var currentUserId = null;

  function shouldShowMessage(msg, currentUserId) {
    if (!msg || currentUserId === undefined || currentUserId === null || currentUserId === "") {
      return true;
    }
    var userId = String(currentUserId);
    var senderId = msg.senderId === undefined || msg.senderId === null ? "" : String(msg.senderId);
    var recipientId = msg.recipientId === undefined || msg.recipientId === null ? "" : String(msg.recipientId);
    if (!recipientId || recipientId === "all" || recipientId === "global") return false;
    var currentUser = window.Store && window.Store.currentUser ? window.Store.currentUser() : null;
    if (currentUser && currentUser.role === "user") {
      var otherId = senderId === userId ? recipientId : senderId;
      var otherUser = window.Store.byId("users", otherId);
      if (!otherUser || (otherUser.role !== "admin" && otherUser.role !== "employee")) return false;
    }
    return (senderId === userId && recipientId !== userId) || (recipientId === userId && senderId !== userId);
  }

  function notify(snapshot) {
    var msg = snapshot.val();
    if (!msg) return;
    msg.id = snapshot.key;
    if (!shouldShowMessage(msg, currentUserId)) return;
    listeners.slice().forEach(function (callback) {
      callback(msg);
    });
  }

  function listen(callback, userId) {
    currentUserId = userId;
    if (listeners.indexOf(callback) === -1) {
      listeners.push(callback);
    }
    var ref = getRef();
    if (!ref) return;

    if (!listening) {
      ref.on("child_added", notify);
      ref.on("child_changed", notify);
      listening = true;
      console.log("Chat listener started");
    }
  }

  function send(message) {
    var ref = getRef();
    if (!ref) return Promise.reject(new Error("Firebase not initialized"));

    message.status = message.status || "sent";
    message.timestamp = message.timestamp || Date.now();
    
    return ref.push(message).then(function (saved) {
      console.log("Message sent:", saved.key);
      // Mark as delivered after a short delay
      setTimeout(function () {
        ref.child(saved.key).transaction(function (current) {
          if (!current || current.status !== "sent") return current;
          current.status = "delivered";
          return current;
        });
      }, 1000);
      return saved;
    }).catch(function (error) {
      console.error("Failed to send message:", error);
      throw error;
    });
  }

  function updateStatus(messageId, status) {
    var ref = getRef();
    if (!ref) return Promise.reject(new Error("Firebase not initialized"));
    console.log("Updating status:", messageId, status);
    return ref.child(messageId).update({ status: status });
  }

  function listSenders(currentUserId) {
    var ref = getRef();
    if (!ref) return Promise.resolve([]);
    return ref.once("value").then(function (snapshot) {
      var senders = {};
      snapshot.forEach(function (child) {
        var message = child.val();
        if (!message || message.senderId === undefined || message.senderId === null) return;
        var senderId = String(message.senderId);
        var recipientId = message.recipientId === undefined || message.recipientId === null ? "" : String(message.recipientId);
        var currentId = String(currentUserId);
        if (recipientId !== currentId && senderId !== currentId) return;
        if (currentUserId !== undefined && senderId === String(currentUserId)) return;
        var user = window.Store && window.Store.byId("users", message.senderId);
        var existing = senders[senderId];
        var ts = Number(message.timestamp) || 0;
        if (!existing || ts > existing.lastMessageAt) {
          senders[senderId] = {
            id: senderId,
            name: message.senderName || (user ? user.fullName : "Unknown sender"),
            role: message.senderRole || (user ? user.role : "user"),
            lastMessageAt: ts,
            lastText: message.text || "",
          };
        }
      });
      return Object.keys(senders).map(function (id) { return senders[id]; }).sort(function (a, b) {
        return b.lastMessageAt - a.lastMessageAt || a.name.localeCompare(b.name);
      });
    });
  }

  function matchesConversation(message, conversationId, currentUserId) {
    if (!conversationId) return false;
    var selectedId = String(conversationId);
    var senderId = message.senderId === undefined || message.senderId === null ? "" : String(message.senderId);
    var recipientId = message.recipientId === undefined || message.recipientId === null ? "" : String(message.recipientId);
    var currentId = String(currentUserId);
    return (senderId === selectedId && recipientId === currentId) ||
      (senderId === currentId && recipientId === selectedId);
  }

  function renderSenderItem(sender, currentUserId, activeId) {
    var letter = (sender.name || "?").charAt(0).toUpperCase();
    var preview = sender.lastText || sender.role;
    return '<button type="button" class="sender-list-item' + (activeId === String(sender.id) ? " active" : "") + '" data-chat-contact="' + escapeHtml(sender.id) + '" data-chat-name="' + escapeHtml(sender.name) + '" data-current-user-id="' + escapeHtml(String(currentUserId)) + '"><span class="sender-avatar">' + letter + '</span><span class="sender-info"><strong>' + escapeHtml(sender.name) + '</strong><span class="muted">' + escapeHtml(preview) + '</span></span></button>';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function refreshSenderList(currentUserId) {
    var list = document.querySelector(".sender-list[data-insert='chat-senders']");
    if (!list) return;
    var activeItem = list.querySelector(".sender-list-item.active");
    var activeId = activeItem ? activeItem.dataset.chatContact : "";
    listSenders(currentUserId).then(function (senders) {
      var html = senders.map(function (sender) {
        return renderSenderItem(sender, currentUserId, activeId);
      }).join("");
      list.innerHTML = html;
    });
  }

  function selectConversation(conversationId, name, currentUserId) {
    var messages = document.getElementById("chat-messages");
    var form = document.getElementById("chat-form");
    var title = document.getElementById("chat-active-name");
    if (!messages) return;
    messages.dataset.conversationId = conversationId || "";
    if (form) form.dataset.recipientId = conversationId || "";
    if (title) title.textContent = name || "Select a conversation";
    Array.prototype.forEach.call(messages.querySelectorAll(".chat-message"), function (message) {
      message.hidden = !matchesConversation({
        senderId: message.dataset.senderId,
        recipientId: message.dataset.recipientId,
      }, conversationId, currentUserId);
    });
  }

  document.addEventListener("click", function (event) {
    var contact = event.target.closest ? event.target.closest("[data-chat-contact]") : null;
    if (!contact) return;
    event.preventDefault();
    document.querySelectorAll("[data-chat-contact]").forEach(function (item) {
      item.classList.toggle("active", item === contact);
    });
    selectConversation(contact.dataset.chatContact, contact.dataset.chatName, contact.dataset.currentUserId);
  });

  function markAllRead(userId) {
    var ref = getRef();
    if (!ref) return Promise.reject(new Error("Firebase not initialized"));
    return ref.once("value", function (snapshot) {
      snapshot.forEach(function (child) {
        var msg = child.val();
        if (!msg) return;
        if (userId !== undefined && (String(msg.senderId) === String(userId) || String(msg.recipientId) !== userId)) return;
        if (msg.status !== "read") {
          ref.child(child.key).update({ status: "read" });
        }
      });
    });
  }

  function stop() {
    var ref = getRef();
    if (ref) {
      ref.off();
    }
    listeners = [];
    listening = false;
    currentUserId = null;
    console.log("Chat listener stopped");
  }

  return {
    listen: listen,
    send: send,
    updateStatus: updateStatus,
    listSenders: listSenders,
    refreshSenderList: refreshSenderList,
    matchesConversation: matchesConversation,
    markAllRead: markAllRead,
    stop: stop,
  };
})();
