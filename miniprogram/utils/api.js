function request(path, options) {
  const app = getApp();
  const baseUrl = app.globalData.apiBaseUrl;
  const opts = options || {};

  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + path,
      method: opts.method || "GET",
      data: opts.data || {},
      header: opts.header || {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && res.data.error) || "请求失败"));
      },
      fail: reject
    });
  });
}

module.exports = {
  request
};
