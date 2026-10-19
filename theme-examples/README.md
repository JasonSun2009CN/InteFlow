# InteFlow — theme examples

五个主页主题备选方案，纯 HTML / CSS / JavaScript（无依赖、无构建）。每一页渲染**同一个主页**
（侧栏 5 个 tab、考试统计、试卷列表、按钮、提示条），只改变视觉语言，便于横向对比。

> 背景：`docs/IDEAS.md` 里记的「不同 themes」想法 —— 在 Settings 里切换主题，CB 风格作默认、
> 古风纸墨作可选项。这里给的是可落地的 5 个候选。
>
> **状态（2026-10-19）：这 5 套已全部落地到真实应用**（Settings → Appearance 切换）。
> 落地时 `CB Classic` 改名 **Clear Blue**（避免与真正的 College Board 混淆），并作为默认主题；
> 全屏练习页保持原 slate/blue 不跟随主题。本目录保留为设计预览 / 对照用。

## 打开方式

直接双击 `index.html`（画廊：5 张实时预览 + 对比表），或单独打开某一页：

| 文件 | 主题 | 一句话 | 应用内 id |
|---|---|---|---|
| `cb-classic.html` | Clear Blue | 蓝白清亮，最"考试"的一版（默认主题） | `clear-blue` |
| `paper-ink.html` | Paper & Ink | 纸墨：暖纸底 + 衬线标题 + 印章红 | `paper-ink` |
| `minimal-light.html` | Minimal Light | 极简灰白，信息密度高，接近 Notion / Linear | `minimal-light` |
| `midnight-navy.html` | Midnight Navy | 暗色学术：深海军蓝 + 冷调高亮 | `midnight-navy` |
| `warm-editorial.html` | Warm Editorial | 暖色杂志：奶油底 + 陶土色强调 + 大字排版 | `warm-editorial` |

也可以在任意一页左下角的 **Theme** 下拉里直接切换主题。

## 交互（都可用，用来判断真实手感）

- 侧栏 5 个 tab 可切换（Exams 是完整页面，其余是占位骨架）
- 搜索框按标题过滤试卷；按 `/` 聚焦搜索框
- `Start` / `Enter answers` 弹出演示提示；提示条右上角 `×` 可关闭
- 统计数字载入时有一次轻微递增（`prefers-reduced-motion` 下关闭）
- 窄屏（< 1024px）侧栏变成抽屉，Esc 或点遮罩关闭

## 文件结构

```
theme-examples/
├── index.html                 # 画廊：5 张 iframe 实时预览 + 对比表
├── cb-classic.html            # 5 个主题页（每页约 20 行，只换 CSS 引用）
├── paper-ink.html
├── minimal-light.html
├── midnight-navy.html
├── warm-editorial.html
└── assets/
    ├── base.css               # 结构与组件（颜色/字体/圆角全部走 CSS 变量）
    ├── mock.js                # 同一份 mock 数据 + 渲染 + 交互
    └── themes/
        ├── cb-classic.css     # 每个主题 = 一个 :root token 块 + 少量局部覆盖
        ├── paper-ink.css
        ├── minimal-light.css
        ├── midnight-navy.css
        └── warm-editorial.css
```

## 主题是怎么定义的

`base.css` 只负责布局与组件结构，所有视觉都来自 CSS 变量：

| 组 | 变量 |
|---|---|
| 底色 | `--bg` `--surface` `--surface-2` `--sidebar-bg` `--row-hover` |
| 文字 | `--text` `--text-muted` `--text-faint` |
| 分割线 | `--border` `--border-strong` |
| 强调 | `--accent` `--accent-hover` `--accent-text` `--accent-soft` |
| 警告 | `--warn` `--warn-soft` `--warn-text` |
| 形状 | `--radius-sm/-md/-lg` `--shadow-sm/-md` |
| 字体 | `--font-ui` `--font-display` `--font-mono` `--tracking-label` `--btn-transform` `--title-weight` |

**换主题 = 换一个 `<theme>.css` 里的 `:root` 块**，其余文件不动。

## 落到 React 版本（已完成 2026-10-19）

实际落地方式如下（见 `frontend/src/theme.ts` 与 `frontend/src/index.css` 的主题层）：

1. 每套主题在 `index.css` 里声明一组**语义变量**（`--t-bg / --t-surface / --t-accent / --t-danger…`），
   由 `.app-theme[data-theme="<id>"]` 选择器承载；
2. 一条共享规则把这些语义变量映射到 `--color-slate-*` / `--color-blue-*` / `--color-primary-*` 等
   Tailwind 颜色族（做法与旧的 `.paper-app` 相同，不需要改任何页面组件）；
3. `--font-display` / `--radius-*` / `--shadow-*` 一并覆盖，另加少量特征样式
   （纸墨风的描边主按钮、大写字距、导航标记颜色、遮罩、背景光）；
4. Settings → Appearance 里选择，存 `localStorage`（键 `inteflow.theme`），`theme.ts` 的 `useTheme()`
   提供状态，`main.tsx` 首帧前 `initTheme()` 写到 `<html data-theme>`；
5. **全屏练习页渲染在 `.app-theme` 之外**，保持原 slate/blue（并显式 `color-scheme: light`）；
   复盘页跟随主题。

注：预览页里的试卷标题、数量来自 mock 数据（`assets/mock.js` 顶部 `EXAMS`），
与真实题库无关，只是为了让列表看起来像 InteFlow。
