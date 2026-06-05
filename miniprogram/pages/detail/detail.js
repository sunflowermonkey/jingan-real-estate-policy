const { findPolicyById, sourceTypeLabel } = require('../../utils/policies');

Page({
  data: {
    item: null,
    sourceTypeText: '',
    error: ''
  },

  onLoad(query) {
    const data = getApp().globalData.policiesData;
    const item = data ? findPolicyById(data.items, query.id) : null;
    if (!item) {
      this.setData({ error: '未找到该内容' });
      return;
    }
    this.setData({
      item,
      sourceTypeText: sourceTypeLabel(item.sourceType)
    });
  },

  onCopyLink() {
    if (!this.data.item || !this.data.item.url) return;
    wx.setClipboardData({
      data: this.data.item.url
    });
  }
});
