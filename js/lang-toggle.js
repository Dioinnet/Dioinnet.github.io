/**
 * 局部中英切换：只翻译界面固定文字（菜单/卡片标题/页面标题/按钮等），
 * 不触碰文章内容。状态存 localStorage，刷新保持。
 */
;(function () {
  'use strict'

  var STORAGE_KEY = 'site-lang'

  // 固定文字对照表（值需唯一，恢复原文靠记录原节点文本，不靠反向查表）
  var ZH_EN = {
    // 导航菜单
    '博文': 'Posts',
    '分类': 'Categories',
    '标签': 'Tags',
    '归档': 'Archives',
    '友链': 'Links',
    '搜索': 'Search',
    // 侧栏卡片
    '公告': 'Announcement',
    '最新文章': 'Recent Posts',
    '网站信息': 'Site Info',
    '文章': 'Posts',
    // 页面标题 / 目录
    '目录': 'TOC',
    // 文章元信息
    '发表于': 'Posted on',
    '更新于': 'Updated on',
    '字数': 'Words',
    '阅读时长': 'Reading time',
    '评论数': 'Comments',
    // 文章页版权
    '文章作者': 'Author',
    '文章作者:': 'Author:',
    '文章链接': 'Link',
    '文章链接:': 'Link:',
    '版权声明': 'Copyright',
    '版权声明:': 'Copyright:',
    '浏览量:': 'Views:',
    '本博客所有文章除特别声明外，均采用': 'All articles on this blog, unless otherwise stated, are licensed under',
    '许可协议。转载请注明来源': '. Please indicate the source when reprinting.',
    '上一篇': 'Prev',
    '下一篇': 'Next',
    // 站点信息卡片
    '文章数目:': 'Posts',
    '本站访客数:': 'Visitors',
    '本站总浏览量:': 'Total views',
    '最后更新时间:': 'Last updated',
    // 其他
    '数据加载中': 'Loading…'
  }

  // title / placeholder 属性对照
  var ZH_EN_ATTR = {
    '回到顶部': 'Back to top',
    '阅读模式': 'Read mode',
    '深色模式': 'Dark mode',
    '浅色模式': 'Light mode',
    '隐藏侧边栏': 'Hide sidebar',
    '显示侧边栏': 'Show sidebar',
    '目录': 'TOC',
    '中/EN 切换': 'EN / 中 Switch',
    '搜索文章': 'Search articles',
    '搜索': 'Search'
  }

  var MONTHS = {
    '一': 'January', '二': 'February', '三': 'March', '四': 'April',
    '五': 'May', '六': 'June', '七': 'July', '八': 'August',
    '九': 'September', '十': 'October', '十一': 'November', '十二': 'December'
  }

  // 正则规则：整节点匹配，如 "全部文章 - 9"、"八月 2026"
  var RULES = [
    [/^全部文章\s*-\s*(\d+)$/, 'All Posts - $1'],
    [/^([一二三四五六七八九十]+)月(\s*)(\d{4})$/, function (m) {
      return (MONTHS[m[1]] || m[1]) + m[2] + m[3]
    }]
  ]

  // 建立忽略内部空白的查表（DOM 里可能是 "文章数目 :"）
  var NORM = {}
  Object.keys(ZH_EN).forEach(function (k) { NORM[k.replace(/\s+/g, '')] = ZH_EN[k] })
  var NORM_ATTR = {}
  Object.keys(ZH_EN_ATTR).forEach(function (k) { NORM_ATTR[k.replace(/\s+/g, '')] = ZH_EN_ATTR[k] })

  var changedText = []   // [{node, orig}]
  var changedAttr = []   // [{el, name, orig}]

  function inArticle (node) {
    var el = node.parentElement
    while (el && el !== document.body) {
      if (el.id === 'article-container') return true
      el = el.parentElement
    }
    return false
  }

  function lookup (core) {
    var key = core.replace(/\s+/g, '')
    if (Object.prototype.hasOwnProperty.call(NORM, key)) return NORM[key]
    for (var i = 0; i < RULES.length; i++) {
      var m = core.match(RULES[i][0])
      if (m) {
        return typeof RULES[i][1] === 'function' ? RULES[i][1](m) : core.replace(RULES[i][0], RULES[i][1])
      }
    }
    return null
  }

  function translate () {
    if (changedText.length) return // 已翻译
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        var p = n.parentNode
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    var list = []
    while (walker.nextNode()) list.push(walker.currentNode)
    list.forEach(function (t) {
      if (inArticle(t)) return
      var raw = t.nodeValue
      var m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/)
      var core = m[2]
      if (!/[\u4e00-\u9fff]/.test(core)) return
      var out = lookup(core)
      if (out === null) return
      changedText.push({ node: t, orig: raw })
      t.nodeValue = m[1] + out + m[3]
    })

    var els = document.querySelectorAll('[title], [placeholder]')
    Array.prototype.forEach.call(els, function (el) {
      ['title', 'placeholder'].forEach(function (name) {
        var v = el.getAttribute(name)
        if (!v) return
        var key = v.replace(/\s+/g, '')
        if (Object.prototype.hasOwnProperty.call(NORM_ATTR, key)) {
          changedAttr.push({ el: el, name: name, orig: v })
          el.setAttribute(name, NORM_ATTR[key])
        }
      })
    })
  }

  function restore () {
    changedText.forEach(function (c) { c.node.nodeValue = c.orig })
    changedText = []
    changedAttr.forEach(function (c) { c.el.setAttribute(c.name, c.orig) })
    changedAttr = []
  }

  function current () {
    try { return localStorage.getItem(STORAGE_KEY) || 'zh' } catch (e) { return 'zh' }
  }

  function updateBtn (lang) {
    var btn = document.getElementById('lang-toggle')
    if (!btn) return
    btn.textContent = lang === 'en' ? '中' : 'EN'
    btn.title = lang === 'en' ? 'EN / 中 Switch' : '中/EN 切换'
  }

  function setLang (lang, persist) {
    if (lang === 'en') translate(); else restore()
    if (persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, lang) } catch (e) {}
    }
    updateBtn(lang)
  }

  var btn = document.getElementById('lang-toggle')
  if (btn) {
    btn.addEventListener('click', function () {
      setLang(current() === 'en' ? 'zh' : 'en')
    })
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setLang(current() === 'en' ? 'zh' : 'en')
      }
    })
  }

  // 刷新后恢复翻译状态
  if (current() === 'en') setLang('en', false)

  // pjax 换页后重新应用（若主题启用了 pjax）
  document.addEventListener('pjax:complete', function () {
    restore()
    if (current() === 'en') translate()
    updateBtn(current())
  })
})()
