const { filterPolicies, formatMetaLine, sourceTypeLabel } = require('../../utils/policies');

const DATA_URL = 'https://sunflowermonkey.github.io/jingan-real-estate-policy/policies.json';

Page({
  data: {
    loading: true,
    error: '',
    metaLine: '',
    lookbackDays: 90,
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'official_policy', label: '官方政策' },
      { key: 'authoritative_media', label: '权威解读' }
    ],
    items: [],
    visibleItems: []
  },

  onLoad() {
    this.loadPolicies();
  },

  loadPolicies() {
    wx.request({
      url: DATA_URL,
      success: (response) => {
        const data = response.data || {};
        const items = Array.isArray(data.items) ? data.items.map((item) => ({
          ...item,
          sourceTypeText: sourceTypeLabel(item.sourceType)
        })) : [];
        getApp().globalData.policiesData = { meta: data.meta, items };
        this.setData({
          loading: false,
          error: '',
          metaLine: data.meta ? formatMetaLine(data.meta) : '',
          lookbackDays: data.meta && data.meta.lookbackDays ? data.meta.lookbackDays : 90,
          items,
          visibleItems: filterPolicies(items, this.data.activeFilter)
        });
      },
      fail: () => {
        this.setData({
          loading: false,
          error: '数据暂时无法加载，请稍后重试'
        });
      }
    });
  },

  onFilterTap(event) {
    const activeFilter = event.currentTarget.dataset.filter;
    this.setData({
      activeFilter,
      visibleItems: filterPolicies(this.data.items, activeFilter)
    });
  },

  onItemTap(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
