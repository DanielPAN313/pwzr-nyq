const STORAGE_KEY = "nyq_local_notifications";
const HIDDEN_KEY = "nyq_hidden_notifications";

function getLocalNotifications() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
}

function getHiddenNotificationIds() {
  const stored = wx.getStorageSync(HIDDEN_KEY);
  return Array.isArray(stored) ? stored.map(String) : [];
}

function saveLocalNotifications(messages) {
  const list = Array.isArray(messages) ? messages.slice(0, 50) : [];
  wx.setStorageSync(STORAGE_KEY, list);
  return list;
}

function appendLocalNotification(notification) {
  const item = {
    id: notification.id || `local-${Date.now()}`,
    type: notification.type || "system_announcement",
    title: notification.title || "系统通知",
    body: notification.body || "",
    status: "unread",
    related_order_id: notification.orderId || "",
    related_game_id: notification.gameId || "",
    create_time: notification.createTime || new Date().toISOString(),
    local: true
  };
  saveLocalNotifications([item, ...getLocalNotifications()]);
  return item;
}

function markLocalNotificationRead(id) {
  saveLocalNotifications(getLocalNotifications().map((message) => (
    String(message.id) === String(id) ? { ...message, status: "read" } : message
  )));
}

function removeLocalNotification(id) {
  saveLocalNotifications(getLocalNotifications().filter((message) => String(message.id) !== String(id)));
}

function hideNotification(id) {
  const ids = getHiddenNotificationIds();
  if (!ids.includes(String(id))) ids.push(String(id));
  wx.setStorageSync(HIDDEN_KEY, ids.slice(-100));
  removeLocalNotification(id);
}

module.exports = {
  appendLocalNotification,
  getLocalNotifications,
  getHiddenNotificationIds,
  hideNotification,
  markLocalNotificationRead,
  removeLocalNotification,
  saveLocalNotifications
};
