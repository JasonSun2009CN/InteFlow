# AGENT.md — InteFlow 项目交接与工作说明

> 面向后续会话 / AI agent / 贡献者。**项目状态变化后请同步更新本文件。**
> 配套文档：[`README.md`](README.md)（英文）、[`README-cn.md`](README-cn.md)（中文）、
> [`docs/OVERVIEW.md`](docs/OVERVIEW.md)（作品说明）、
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/IFMD.md`](docs/IFMD.md)、
> [`docs/IDEAS.md`](docs/IDEAS.md)（修改想法记录）、[`ROADMAP.md`](ROADMAP.md)。

---

## 1. 项目是什么

本地优先的学习工作流 Web 应用：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件**。

- 技术栈：FastAPI + React（Vite / TypeScript / Tailwind 4）+ SQLite 单文件；PyMuPDF 转换；
  WeasyPrint（PDF）/ python-docx（DOCX 导入 + 导出）；OCR = 系统 `tesseract`（可选）或 macOS Vision（可选）。
- 前身：**SATeacher**（一个 SAT 刷题工具）。
  本项目在其基础上**全量迁移 + 改名 + 逐步泛化/打磨**。前身的历史规划文档保留在
  [`docs/legacy/`](docs/legacy)（**仅作参考**，不要当成 InteFlow 的当前规格）。

## 2. 两条铁律（不变量）

1. **LLM 不在主链路**：导入/解析/判分/导出全部确定性本地计算，**0 token**；只有用户显式点击
   （AI 讲解 / 连通性测试 / 在设置里开启 AI 评分后的单词考试提交）才调用外部 API。
2. **本地优先**：所有数据在 `data/`（SQLite + 每篇文档的 `doc.ifmd.md` 与图片），不上传云端。
3. 界面默认英文，可在 **Settings → Language** 切换为中文（全前端 i18n，0 token；考试原文、用户内容与后端报错保持原样）；与维护者交流用中文；**有疑问必须先用 `question` 工具问，不许自己猜**。

## 3. 当前状态（2026-10-24）

| 项 | 值 |
|---|---|
| 后端测试 | `pytest` **339 passed** |
| 前端类型检查 + 构建 | `npm run build` **0 错误** |
| 前端组件测试 | `npm test` **165 passed, 5 skipped** |
| 内置题库 | 44 单元 / 1186 题（`backend/app/builtin/sat2025-rw-b`） |
| API 面 | 67 条（见 `docs/ARCHITECTURE.md`） |
| 本地词典 | 韦氏大学词典 92,006 条；首次查词自动建 `data/dictionary/mw.db`；支持词条内的 Definition for English Learners；另有用户自定义词典（SQLite） |

> 复盘（分析模式）重构已落地：全屏复盘、左上角折叠题目导航、Pages 式分析编辑器（可保存/续写/导出）、
> 整套解析 Notebook 预览、作答历史 Sessions 页、多答案选择题 + 填空题、设置里的用户名与 AI 识别兜底开关；
> Normalize 已彻底移除。2026-10-19 修复：分析页异步加载后不再显示空白；Preview 保留单换行（remark-breaks）。
>
> 2026-10-19 新增：**Vocabulary 生词本**（左侧 6 tab 的占位页已替换）+ **本地韦氏词典** + 复盘工作台
> 改为 **2-of-4 分屏**（题目 / 分析 / AI Tutor / 生词本），支持从题目/选项拖词入表并由 AI 选义。
>
> 2026-10-20：Settings 增加 **AI sense matching** 与 **Definition for English Learners** 两个开关。
> 关闭前者时拖词不调用 LLM，直接用第一条韦氏释义；后者不是另一本词典，而是韦氏词条内部的
> *Definition for English Learners* 栏目：有该栏目的词优先用它，没有就回退普通释义。索引在构建时把栏目
> 拆到 `learner_definition` 列，`learner_count` 记录有多少词带该栏目（当前这份 `韦氏大辞典.eudb` 实测为 0，
> 即文件本身不带该栏目；换含栏目的版本后自动生效）。
>
> 2026-10-20：**用户自定义词典（My dictionary）**。Settings 可导入 CSV/TSV/JSON/TXT 或手动增删词条；
> 词典存在 `app.db` 的 `custom_dictionary_entries` 表。开启 `custom_dictionary_enabled`（默认开）后，查词
> 先查自定义词典，未命中再回退韦氏；拖词候选、逐条添加、单词考试的释义引用也会优先使用自定义词条。0 token。
>
> 2026-10-20：**单词考试（Word test）** 已落地，入口在 Vocabulary 页顶部 **Word list / Word test** 两个 tab。
> 从当前试卷词表随机抽题（可设数量或全测），两种模式：**English → Chinese**（手写释义）与
> **Chinese → English (spelling)**（看释义拼单词）。默认本地判分 0 token：拼写忽略大小写/空格/标点，
> 释义用宽松匹配（精确 / 分段 / 足够长的子串 / 多词包含）；Settings 新增
> `vocab_exam_ai_grading`（默认关），开启后提交时由模型参考词表释义 + 韦氏词典严格判分，失败自动回退本地。
> 结果页显示正确率、考察范围、每题正确答案/用户答案，并生成**紧凑 JSON 二维码**；题量大时自动拆成
> 多个 QR（`IFWT1|<id>|part/total|`），另可下载 `.json`。
>
> 2026-10-20：**学科分类（Subjects）** 已落地。用户可自由创建/改名/换色/删除学科（如 SAT Math、Physics），
> 每套试卷最多归属一个学科。Library 列表、Answer-key 页顶部可直接下拉归类（选 “+ New subject…” 可现场创建并
> 自动归类）；Library 还提供 Manage subjects 管理与按学科过滤，Exams 首页显示学科徽章并可按学科筛选。
> 删除学科只把试卷移回 Uncategorized，不删试卷；导入时也可先选目标学科。0 token，全部本地。
>
> 2026-10-20：**Review sets（原 Mistakes）** 已落地，侧栏标签改为 **Review**，页面内分 **Mistakes / Starred** 两 tab。
> Mistakes 汇总所有已提交作答的错题，按题去重并保留**最近一次**作答（后来做对则自动移出）；Starred 是用户显式标记的
> 题目（`question_stars` 表），可在练习页、复盘工作台或 Mistakes 列表点星。两栏都支持按套题/题干/选项搜索、按 exam
> 过滤、按时间正/倒序，并复用复盘的分析编辑器；右侧显示当前分析，若存在旧分析（legacy `analyses` 或额外页）也全部
> 只读列出。0 token。
>
> 2026-10-20：**左侧栏 Compact 模式**。桌面端可在侧栏顶部收缩为 80px 图标栏（仅图标 + hover 原生 tooltip），
> 再点展开；状态存 `localStorage` 键 `inteflow.sidebar.compact`。移动端始终使用完整抽屉，不受影响。
>
> 2026-10-21：**项目官网** `website/`（纯静态，无依赖、无构建）。**中英双语落地页**
> （`index.html` / `en.html`，页头右上角切换）覆盖全部功能：两条铁律、五步工作流、22 项功能索引（可筛选）、
> 五套主题实时预览、InteFlow-MD / 架构 / 数据目录代码页、FAQ、快速开始。主题预览页复用 `theme-examples` 的 `base.css` + `mock.js` + 5 份 token CSS（改为 6 tab 导航，
> 并带 `← Back to the website`）。部署由 `.github/workflows/pages.yml` 发布 `website/` 到 GitHub Pages
> （仓库 Settings → Pages → Source: GitHub Actions）；本地预览见 `website/README.md`。
>
> 2026-10-21：**错题分析模板**已落地。Settings → **Analysis template** 保存一份全局 Markdown 模板
> （settings 键 `analysis_template`）；复盘工作台与 Review 页共用的分析编辑器在题目**没有已保存分析**时
> 自动把模板填为草稿（有分析绝不覆盖，notebook 加载完成后才填）。模板未改动不会自动保存，避免空白题被算作
> “已分析”而进入导出；用户开始输入后才走原有自动保存。0 token。
>
> 2026-10-22：**考试计时可选正计时 / 倒计时**。开始屏先选模式；倒计时填写分:秒，到 `00:00` **自动交卷**。
> 选择会按试卷记忆（`sessions.timer_mode` / `timer_seconds`），没有该卷记录时回退最近一次任意考试；
> `GET /api/sessions/timer-preference` 返回默认值，`PATCH /api/sessions/{id}/timer` 在开始考试时落库。
> 前端另有 localStorage 兜底（`inteflow.practice.timer[.<docId>]`）。0 token。
>
> 2026-10-22：**中文界面模式**。Settings → Language 可在 English / 中文之间即时切换（`localStorage`
> 键 `inteflow.language`）；侧栏、页面、弹窗、按钮、提示等全部前端文案走
> `frontend/src/lib/i18n.tsx` 的 `t()`，默认英文、缺失翻译回退英文；考试原文、用户输入/分析、后端报错
> 不翻译。`<html lang>` 同步切换。
>
> 2026-10-22：**简单数学示例卷**。`docs/examples/simple-math.ifmd.md` 是 10 题（算术 / 代数 / 分数 /
> 百分比 / 几何 / 平均数 / 指数 / 应用题 / 多选 / 填空）的可直接导入 demo，覆盖 `@material`、`multi=1`、
> `kind=blank` 与 `$...$` 公式，答案与解析全部内联（`answers: inline`）。已按普通导入路径加入本机 Library；
> 解析由 `backend/tests/test_demo_math_ifmd.py` 守护。0 token。
>
> 2026-10-22：**官网在线演示 + 下载 ZIP**。中英双语落地页新增 `#demo` 区块：4 道示例题（态度 / 词义 /
> 代数 / 填空），可选题号、标记待看、计时与交卷；成绩页可进入复盘。界面按真实应用还原：练习页是
> 文章 + 题目双卡、蓝色选项、题号底栏；复盘页是 **2-of-4 工作台**（题目 / 分析 / AI Tutor / 生词本，
> 两侧工具可切换、可交换）。左侧明确列出与完整应用的差异（固定 4 题、无后端、AI 为预置文案、
> 复盘无拖拽 / 自动保存 / Notebook / 导出、仅模拟默认主题）。判分、计时与生词收藏都在浏览器内完成
> （生词存 `localStorage` 键 `inteflow.website.demo.vocab`），0 token。题目与双语文案在
> `website/assets/site.js` 的 `DEMO` 对象，样式在 `site.css`。Hero、Demo 与 Quick start 都加了
> **Download ZIP**，指向 GitHub 的 `archive/refs/heads/main.zip`（压缩包不随网站入库）。
>
> 2026-10-23：**官网改为多页 + 平台下载前移**。首页 `index.html` / `en.html` 在 hero 下直接放
> “先选平台”下载区（macOS Apple Silicon / macOS Intel / Windows x64 / 源码），header 与 hero 主按钮
> 也改为进入 `download.html` / `download-en.html`。内容拆分为 `features*.html`（边界 / 工作流 / 22 项功能 /
> 架构 / FAQ）、`demo*.html`（四个独立演示页：做题 / 2-of-4 工作区 / 错题集 / 生词集）、
> `themes*.html`（主题预览）与 `download*.html`（平台安装包、首次打开说明、源码运行）。演示页共用
> `data-demo-start` 与 `DEMO` 数据；交卷尝试存 sessionStorage，收藏 / 错题掌握 / 单词掌握分别存
> localStorage。`demo-mistakes.html` 与 `demo-vocabulary.html` 提供筛选、搜索、列表-详情与掌握状态切换。所有页面共用 `assets/site.css` / `site.js`；新增 `assets/downloads.js`：读取
> GitHub 最新 release，按 `arm64` / `x64` / `.dmg` / `.exe` 匹配并升级平台卡片为直接下载；无 release、
> 404 或限流时保留“前往 Releases / 源码运行”的兜底，不写死版本号。内部链接全部使用相对路径，旧的
> `/#demo`、`/#features`、`/#quickstart` 等锚点由 `site.js` 重定向到新页面；`sitemap.xml` 已列出 16 个
> 中英页面。安装包仍由 `.github/workflows/desktop.yml` 在 `v*` tag 时生成，不把大文件提交进 Pages。
>
> 2026-10-21：**复盘工作台工具切换器改为图标按钮行**。原来每个 pane 头部是一个 “Switch…” 下拉菜单，
> 现在改为横向排列的**四个图标 + 小字标签**按钮（Question / Analysis / AI Tutor / Vocabulary，Lucide 图标），
> 当前工具高亮（`aria-pressed`），另一侧的工具略淡并提示 “click to swap”；点另一个 pane 已有的工具仍按原逻辑
> 左右互换。纯前端改动，未改任何接口 / 存储格式。
>
> 2026-10-24：**下载渠道与桌面端清理**。官网首页不再把源码 ZIP / 旧启动器当主入口：平台卡片全部指向
> Electron 安装包（macOS arm64/x64、Windows x64），源码运行只保留在下载页的 “From source / 开发者选项” 小节。
> 删除仓库根目录的旧 `InteFlow.app` / `InteFlow.command`（它们会打开终端和浏览器，容易和桌面版混淆）。
> **新下载的桌面应用是纯空的**：安装包不含 `app.db`、导入文档、作答、分析、生词本、导出或词典索引；
> `desktop/verify_bundle.py` 在 CI 打包后校验资源目录，发现本地数据直接失败。内置 SAT 题库仍随包分发，
> 但新增设置 `show_builtin_library` **默认关**，Library 首屏只有导入卡片；需要时在 Settings 打开。
> 桌面端新增 **File → Reset local data…** 与 Settings → Desktop 的同一入口：停止后端、清空 app-data
> 与 Electron 的 localStorage/cache，然后重启回到首次启动状态（保留 `dictionary/*.eudb` 源文件）。
> `.github/workflows/desktop.yml` 现在在 `main` push 上也构建（仅上传 artifact），`v*` tag 才发布 Release。
>
> 2026-10-25：**官网精简重排（首页 + 功能页）**。目标：减少内容与视觉噪音，保留米色纸感 + 橙色强调。
> 1. **首页**从 5 个区块压到 4 个：hero（去掉平台 pill、命令提示、印章与 explore 卡片区）→ 三张紧凑
>    下载卡片（macOS arm64 / macOS x64 / Windows，`all releases` 与 `from source` 降为文字链接）→
>    三栏 highlights（题库进来 / 逐题复盘 / 把理解带走）→ 单个收尾 CTA。
> 2. **功能页**从 22 张筛选卡片 + 5 段长步骤压到：瘦 hero → 两条原则 → 五步工作流卡片 → 六项核心能力
>    → 可折叠的完整 22 项索引（原生 `<details>`，按导入 / 练习 / 复盘 / 词汇 / 输出分组）→ 数据条 →
>    架构 → 6 条 FAQ → 收尾 CTA。移除了筛选栏与 `data-cat` / `data-filter` 标记（`site.js` 里的筛选
>    代码保留但不再命中）。
> 3. **全站** header 导航统一为 5 项（下载 / 功能 / 在线试用 / 主题 / 问答，英文对应），GitHub 只保留在
>    header actions；footer 的产品 / 文档 / 项目三栏同步精简。样式改动集中在 `assets/site.css` 末尾的
>    “2026 layout refresh” 区块；中文标题单独覆盖 `text-wrap: wrap`，避免 `balance` 把短句拆成三行。
> 4. `404.html` 标题改为显式两行（`这一页` / `走丢了。`），不再被自动断行拆开。
>    中英页面保持同步；`website/README.md` 已同步新的页面结构与编辑说明。

> 2026-10-25：**SAT 特殊格式 + 词典工具**。以下改动：
> 1. **双篇题**：`questions.material2`（旧库自动迁移）+ `.ifmd.md` 的 `@material2`（必须位于
>    `@material` 与 `@stem` 之间）；PDF/DOCX/LLM 兜底在源文件同时出现 `Text 1`/`Text 2`
>    （或 `Passage 1/2`）时自动拆分，否则不猜。练习/复盘/Notebook/导出以 **Text 1 / Text 2**
>    上下叠放显示（`PassageText.tsx`）。
> 2. **诗歌/摘录**：材料里的单换行按原文保留，练习/复盘/Notebook/导出均生效；导入启发式只在
>    ≥4 行、续行多为大写开头且行长较短时按诗歌保留换行（`normalize.join_paragraph`）。旧卷
>    （如内置 25年10月北美 Harder B 第 2 题）在旧版导入时已被合并，需重新从源 PDF 导入才能恢复。
> 3. **图表裁剪**：`convert/images.py` 的 `_absorb` 增加向下吸收短标签（x 轴刻度/表格分类行），
>    位图图表若带独立文字层改为按页面区域重新截图；正文长句不会被吞进图片。仍然离线、0 token。
> 4. **复盘第 5 个工具 Dictionary**（2-of-5 分屏）：`DictionaryPane.tsx` 直接用内置韦氏，本地查询
>    0 token；Settings 新增 `dictionary_auto_lookup`（默认开，输入即查；关闭后回车查词），面板内可
>    **Add my own definition** 写入 My dictionary（查词优先）。复用 `/api/dictionary/*` 与
>    `/api/custom-dictionary/entries`，未新增 API。
> 5. **修复练习页题面闪烁**：计时器每秒重渲染时 `RichText` 的内联 Markdown 组件身份变化导致图片
>    重挂/懒加载零高度，侧栏滚动条抖动；改为模块级组件 + `memo`/`useMemo`，并对文章侧栏加
>    `scrollbar-gutter: stable`。回归测试在 `RichText.test.tsx`。
> 6. **单词表释义自动填充开关**：Settings → Vocabulary 的 **Auto-fill definitions in the word list**
>    （键 `vocab_auto_definition`，默认开）。关闭后拖词只添加 Word、Meaning 留空（0 token，不查词典），
>    方便学生自己写释义；从词典面板显式 Add 的路径不受影响。
> 7. **设置页版本号 + 自动保存**：标题下显示 `/api/health` 的版本（桌面端由 Electron 通过
>    `INTEFLOW_VERSION` 传入打包版本，源码回退版本见 `backend/app/main.py` 的 `VERSION`）；移除 Save 按钮，改为 600ms 防抖自动保存，
>    连续输入合并、保存中继续编辑排队，失败下次修改重试。移除 API Key 前会清空排队并等待在途保存。

> 2026-10-26：**Settings 页重做（布局 + 视觉）**。目标是消掉原来的“单列窄卡片 + 大留白”，
> 让它读起来像设计师做的设置页，而不是表单堆叠：
> 1. **两栏结构**：左侧 `On this page` 目录（图标 + 高亮，桌面 sticky；窄屏是横向可滚动药丸条），
>    右侧内容列。页面宽度从 `max-w-2xl` 提到 `max-w-6xl`，行内用“左侧标签 / 右侧控件”的
>    两列节奏（`FieldRow`），信息密度明显提高但仍有呼吸感。
> 2. **分区**：Profile / Appearance / AI model / Importing / Vocabulary / Writing /（桌面端）Desktop。
>    每个分区是“图标 + 标题 + 一句说明 + 一张 hairline 卡片”，卡片内行与行之间用细线分隔；
>    原来的「Show built-in library」并入 Importing，不再单独占一张卡。
> 3. **开关改成 switch 外观**：视觉是 44×24 的轨道 + 圆点，但底层仍是 `<input type="checkbox">`
>    （保留 `role=checkbox` 与 label 关联，测试与读屏行为不变），并且整块开关本身可点。
> 4. **主题选择器改成 5 个迷你窗口预览**（用各主题自己的 ground / surface / accent / ink 上色），
>    桌面上一行 5 个；语言改成两段式 segmented control。
> 5. **状态条**：标题下的自动保存状态改成带状态点的小药丸（idle / dirty / saving / saved / error），
>    版本号并列显示；Test connection 移到 AI model 分区标题右侧，结果以带图标的横条出现在卡片下方。
> 6. 纯前端改动：`frontend/src/pages/SettingsPage.tsx`、`components/ui/ThemePicker.tsx`、
>    `components/ui/LanguagePicker.tsx`；新增文案全部走 `t()`（中文表已补）。
>    未改任何接口、设置键或保存逻辑；`npm test` 仍 165 passed / 5 skipped，`npm run build` 0 错误。
> 7. **发布 `v1.0.1`**：`frontend/package.json`、`desktop/package.json`（含 lock）与
>    `backend/app/main.py` 的源码回退 `VERSION` 同步为 `1.0.1`；CI 的 “Set version from tag”
>    仍会按 tag 重写 desktop 版本，因此安装包版本以 tag 为准。

## 4. 迁移与改名映射（已执行）

从 SATeacher 全量迁移（排除 `.venv` / `node_modules` / `dist` / `data` / `.env` / IDE 文件），并做了如下改名：

| 旧 | 新 |
|---|---|
| `SATeacher`（App 标题/产品名） | `InteFlow` |
| `sateacher`（npm 包名 / localStorage 键 / 测试临时前缀） | `inteflow` |
| `SATEACHER_DATA` / `SATEACHER_API` / `SATEACHER_OCR_LANG` | `INTEFLOW_DATA` / `INTEFLOW_API` / `INTEFLOW_OCR_LANG` |
| 格式名 `SAT-MD` | `InteFlow-MD`（短 handle **`ifmd`**） |
| 模块 `backend/app/satmd/` | `backend/app/ifmd/` |
| 前端 `SatMdTemplate.tsx` | `IfmdTemplate.tsx` |
| 扩展名 `.sat.md` | `.ifmd.md` |
| front matter 键 `satmd: 1` | `ifmd: 1` |
| 磁盘文件 `doc.sat.md`（46 个，含内置题库） | `doc.ifmd.md` |
| `convert/bluebook.py`（+ symbol/测试/fixture） | `convert/twocolumn.py`（`TwoColumnResult` 等） |
| localStorage 键 `sateacher.workspace.*` | `inteflow.workspace.*` |
| DB 列 `satmd_path` / 函数 `satmd_path()` `set_satmd_path()` | `ifmd_path` / `ifmd_path()` `set_ifmd_path()` |
| 测试 `test_satmd_writer.py` / `test_bluebook.py` | `test_ifmd_writer.py` / `test_twocolumn.py` |
| `docs/SAT-MD.md` | `docs/IFMD.md` |

**保持不变**（属于 SAT 内容，不是品牌）：内置题库 id `sat2025-rw-b` 及其 SAT 内容标题。

## 5. 关键决策（用户已确认）

| 事项 | 决定 |
|---|---|
| 迁移范围 | **全量**迁移（含 OCR、内置题库、CB 规范化、导出、测试），再逐步 refine |
| 改名 | **全部改名**（见 §4 映射），不只是 UI 文案 |
| 题目模型 | 把 `sec` **泛化为自由板块标签**（去掉 `CHECK (sec IN ('rw','math'))`），SAT 卷仍填 `rw`/`math` |
| 内置题库 | **保留**（开箱即用的示例题库） |
| 计时 | 正计时 + 倒计时两种；开始屏手输倒计时，默认值按试卷读取上次提交的计时方式（无记录回退最近一次任意考试，再回退 localStorage）；倒计时到 0 **自动交卷** |
| 主界面信息架构 | **左侧栏 6 个 tab**：Exams（选卷）/ Library（导入+题库+试卷列表）/ Sessions（作答历史）/ Review（错题集 + 精选题集）/ Vocabulary（生词本）/ Settings。**练习页与复盘页全屏无侧栏**；答案录入在侧栏布局内。窄屏侧栏变抽屉；桌面端可 **Compact** 为 80px 图标栏（存 `inteflow.sidebar.compact`，移动端不生效） |
| 复盘（分析模式，2026-10-19） | 进入复盘**隐藏左侧栏**；题号导航默认缩到左上角、点击旋转展开为**悬浮**面板（All / Wrong / Correct），点击某题即选中并收起；**2-of-4 分屏**：题目 / 分析 / AI Tutor / 生词本，每侧可切换到另外三者；选择已在另一侧的工具则左右互换；默认左题目右分析；分隔条可拖拽/方向键。导出与 Notebook 放顶栏（不占用分屏）。**2026-10-21**：每侧头部的工具切换由下拉菜单改为**四个图标 + 标签的横向按钮行**（当前项高亮，另一侧的工具点按即交换）。 |
| 分析存储与导出 | 一套试卷 = 一套分析（`analysis_pages` 一题一页，按题序）；旧 `questions.explain` 首次读取时映射迁入（`id` 为 null）。复盘页顶部 **Notebook** 全屏预览：试卷标题 → 所有已写解析的题目（题干/图表/解析）+ 导出按钮。导出 md / docx / pdf **只含已写解析的题**：浏览器下载 + 在 `data/exports/` 存一份，响应头 `X-Export-Path` 显示路径；封面页含设置里的用户名 |
| 错题分析模板（2026-10-21） | Settings → **Analysis template** 一份全局 Markdown 模板（settings 键 `analysis_template`）。分析页没有已保存内容时自动填为草稿；已有分析绝不覆盖；模板未改动不落库（导出仍只算真正写过的题）；notebook 异步加载完成前不填。0 token |
| 题型扩展（2026-10-19） | 选择题支持多选（头部 `multi=1`，答案 `A,C`）；新增填空题（`kind=blank`，无选项，答案 `a \| b` 多个可接受答案）；**导入时未识别到选项一律按填空题处理** |
| 双篇题 / 诗歌（2026-10-25） | 第二篇材料存 `questions.material2`，`.ifmd.md` 用 `@material2`；UI 上下叠放 Text 1/Text 2；材料单换行保留（诗歌版式）。导入仅在同时出现 `Text 1`/`Text 2` 标签时拆分 |
| 图表裁剪（2026-10-25） | 标题、y 轴刻度、x 轴/分类短标签自动并入截图；只吸收短标签，长句正文不会被吞；位图带文字层时按页面区域重新截图；0 token |
| 词典工具（2026-10-25） | 复盘 2-of-5 分屏新增 **Dictionary**；内置韦氏本地查询；Settings `dictionary_auto_lookup`（默认开）控制输入即查；面板可添加自定义释义（写入 My dictionary，优先查询） |
| 设置页版本 / 自动保存（2026-10-25） | 版本来自 `/api/health`（桌面端 `INTEFLOW_VERSION`）；设置改动 600ms 防抖自动保存，无 Save 按钮；API Key 只写、移除前避免竞态 |
| 设置页布局（2026-10-26） | 两栏：左侧 sticky 分区目录（窄屏横向药丸条）+ 右侧分区卡片；分区为 Profile / Appearance / AI model / Importing / Vocabulary / Writing / Desktop。开关注释外观用 `<input type=checkbox>` 保持可访问性；主题选择器为 5 个迷你窗口预览，语言为 segmented control；自动保存状态与版本以药丸显示在标题下 |
| 单词表释义自动填充（2026-10-25） | Settings `vocab_auto_definition`（默认开）：拖词入 Vocabulary 时自动写入韦氏释义；关闭后只加单词、Meaning 留空，0 token。词典页手动 Add 不受影响 |
| AI 识别兜底开关 | 设置项 `llm_fallback`（默认开）。关闭时导入失败会提示启用；`convert/pdf.py` 与 `imports.run_ai_fallback` 均检查该开关 |
| 生词释义开关（2026-10-20） | 设置项 `vocab_ai_sense`（默认开）：关闭后拖词不调用 LLM，使用第一条真实韦氏释义并提示。设置项 `vocab_learner_definitions`（默认关）：开启后优先使用韦氏词条内部的 **Definition for English Learners** 栏目；词条没有该栏目时自动回退普通释义。**不再有单独的 learner `.eudb`**。设置项 `custom_dictionary_enabled`（默认开）：优先查用户自定义词典，未命中再查韦氏 |
| 作答历史 | 左侧栏 Sessions 页：按做题时间倒序，可搜索、可逐条删除（`GET/DELETE /api/sessions`）。**只有提交过（submit）的作答才算一条记录**；开始练习只建临时 session，中途离开即删除 |
| Normalize | **彻底删除**（前端入口 + 后端接口/任务/测试）。`convert/normalize.py` 是文本清洗工具，**保留**，与已删功能无关 |
| 视觉风格（2026-10-19） | **5 套主题**：Clear Blue（默认）/ Paper & Ink / Minimal Light / Midnight Navy / Warm Editorial，在 Settings → Appearance 里切换并存在 `localStorage`（`inteflow.theme`）。实现：`frontend/src/theme.ts` 管状态，`index.css` 里 `.app-theme[data-theme=…]` 声明语义变量、再由一条共享规则映射到全部 Tailwind 颜色族（外加各主题的特征样式：显示字体 / 圆角 / 描边主按钮 / 导航标记 / 遮罩 / 背景光）。**全屏练习页明确不跟随主题**（保留原 slate/blue），复盘页跟随；旧 `.paper-app` 作用域已删除 |
| 错题集合（已实现 2026-10-20） | 汇总所有已提交 session 的错题，**按题目去重并保留最近一次作答**（后来做对即移出）；可按套题/题干/选项搜索、exam 过滤、时间排序 |
| 单词集合（已实现 2026-10-19） | **一套试题对应一份词表**；重刷同一试卷再加词是**在原词表上修改**，不新建。Vocabulary 页 = 左侧考试索引 + 右侧词表编辑器（手动增删改、查词、导出 xlsx） |
| 单词考试（已实现 2026-10-20） | Vocabulary 页内 **Word list / Word test** 两 tab。模式：English → Chinese（手写释义，本地宽松匹配）、Chinese → English（看 Meaning/韦氏兜底释义拼写，忽略大小写/空格/标点；Word 列可用 `;` `/` `\|` 分隔多个可接受拼写）。测试量可手输或全测；题目从当前词表随机抽取。结果含正确率、考察范围、每题正确答案/用户答案 + 紧凑 JSON 二维码（大卷自动拆多个 QR，`IFWT1\|<id>\|part/total\|`）。Settings 的 `vocab_exam_ai_grading` 默认关；开启后提交时 AI 参考词表 + 韦氏释义严格判分，失败回退本地 |
| 学科分类（已实现 2026-10-20） | 全局 `subjects`（名称 + 调色板颜色），每套试卷最多一个 `subject_id`。Library 行内下拉直接归类/现场创建；Answer-key 页顶部同样可改；Library 的 **Manage subjects** 支持增删改与过滤；Exams 首页显示徽章并按学科筛选。删除学科只把试卷变为 Uncategorized。姓名大小写不敏感去重，0 token |
| 精选题集（已实现 2026-10-20） | `question_stars`（每题最多一行，级联删除）。练习页/复盘工作台/Mistakes 列表点星即时持久化；Review 页 **Starred** tab 展示，支持搜索、exam 过滤、时间排序、取消星标与查看分析。与错题集共用同一分析编辑器 |
| 查词 / 生词释义 | **本地韦氏词典**（Eudic `.eudb` → `data/dictionary/mw.db`，92,006 条，0 token）。只显示英英原文；首次查词自动建索引。拖词入表时**可**显式调用一次 LLM 在真实候选中选义（`vocab_ai_sense`，不能编造条目）；关闭/无 key/失败回退第一条释义并提示。`vocab_learner_definitions` 优先使用词条内的 Definition for English Learners 栏目并回退普通释义 |
| 用户自定义词典（2026-10-20） | 单本全局词典，存 `custom_dictionary_entries`（word/pos/definition，word_key 唯一）；Settings 支持手动增删与 CSV/TSV/JSON/TXT 导入。查词先自定义后韦氏；拖词候选与 `from-entry` 支持 `source=custom`；全部 0 token |
| 查词 / 错题分析导出 | 查词已实现（本地词典）；**错题分析导出已实现**（一套试卷一套笔记本，md/docx/pdf 存 `data/exports/`） |
| LLM 预置目录 | 默认服务商 = **OrcaRouter**（`providers.DEFAULT_PROVIDER`）；共 **19 家**：`deepseek` 拆成 `deepseek-openai` / `deepseek-anthropic`（旧 id 有别名 + DB 迁移），并新增 `xai`（Grok）、`custom-anthropic`。base URL **按各官方文档原样存**：OpenAI 系自带 `/v1`，Anthropic 系不带（`endpoint_url()` 只在缺版本段时补 `/v1`），所以文档上的 URL 可以直接粘贴 |
| 文档语言 | `README.md` 英文、`README-cn.md` 中文、`AGENT.md` 中文、`docs/IDEAS.md` 中文（**不建 CLAUDE.md**） |
| 界面语言（2026-10-22） | 默认英文；Settings → Language 即时切换中文（`localStorage` 键 `inteflow.language`）。所有前端 UI 文案经 `frontend/src/lib/i18n.tsx` 的 `t()`；考试原文、用户内容与后端报错不翻译 |
| 桌面端分发（2026-10-24） | 官网主入口只用 Electron 安装包（`.github/workflows/desktop.yml`，macOS arm64/x64 + Windows x64）；旧 `InteFlow.app` / `InteFlow.command` 已删除。源码运行仅作为开发者选项保留在下载页与 README。`main` push 构建并上传 artifact，`v*` tag 发布 GitHub Release |
| 新安装是纯空应用（2026-10-24） | 安装包不包含任何本地运行数据；`desktop/verify_bundle.py` 在 CI 校验资源目录（`app.db` / `mw.db` / `.eudb` / `data/`）。内置 SAT 题库仍随包，但 `show_builtin_library` 默认关，Library 首屏为空。桌面端 File 菜单与 Settings 提供 **Reset local data…**（清空 app-data + localStorage/cache 并重启，保留 `dictionary/*.eudb` 源文件） |

## 6. 待办 / 已知缺口

### 本次迁移之后要做的
1. ~~**计时方案**~~ **已实现（2026-10-22）**：开始屏可选正计时/倒计时；倒计时手输分:秒，到 0 自动交卷；
   默认值按试卷读取上次提交的计时方式（无记录回退全局最近一次）。详见 §5。
2. ~~**查词（占位）**~~ **已实现（2026-10-19/20）**：本地 Merriam-Webster（Eudic `.eudb`）索引 + 查词接口 + Vocabulary 页 + 复盘拖词选义；词条内 Definition for English Learners 栏目可优先使用；用户自定义词典可在 Settings 导入/维护并优先查词。
3. ~~**错题分析导出（占位）**~~ **已实现（2026-10-19）**：一套试卷一套分析笔记本，可导出 md/docx/pdf 并留副本到 `data/exports/`；复盘页 Notebook 可先预览整套解析，导出只包含已写解析的题。单词表导出仍是 xlsx。
4. **UI/UX 打磨**（用户逐页审查）：已完成——左侧栏 6 tab 工作区（窄屏抽屉）+ 纸墨风同步 + 复盘页全屏重构
   （2026-10-19）。继续审查中：练习界面、复盘工作台（分析编辑器/导航/抽屉）的细节可能还要微调。
5. ~~**Mistakes 仍是占位页**~~ **已实现（2026-10-20）**：侧栏改名 **Review**，内含 **Mistakes**（按题去重保留最近作答）与 **Starred**（精选题集）；支持搜索、exam 过滤、时间排序、分析查看/编辑。Vocabulary 已完成；**单词考试**与**学科分类**均已完成。

### 已知缺口
- 图表若仍缺表头/分类标签，后续可加**视觉模型兜底**（检测图片 → 回报页码 → 多模态模型识别 + 截图）；
  会消耗 token，需单独开关，且不进入默认导入主链路。
- 旧版导入的诗歌行已被合并，只能重新从源 PDF 导入恢复。
- 内置「25年10月北美 · Harder B」第 7 题的图表 PNG 仍是旧裁剪（不含分类标签）；现已用文字按正确柱序
  标注（`self-dealing · undistributed income · taxable expenditures · excess business holdings`），
  重新从源 PDF 导入后才会得到完整截图。

### 泛化的尾项
- `guess_sec()` 的启发式仍是 SAT 调参（`rw`/`math` 信号）；无标题时回退到
  `INTEFLOW_DEFAULT_SECTION`（默认 `rw`）。非 SAT 题库可显式写 `sec=...`，或改这个环境变量。
- `docs/legacy/` 里的规划文档含 SAT 语境，仅作参考。

## 7. 运行与验证命令

```bash
# 一键启动（缺环境先 setup + 起前后端 :8000/:5173 + 开浏览器）
./start.sh                  # Windows: .\start.ps1（或双击 start.bat）

# 只建环境（幂等，不启动）
./scripts/setup.sh          # Windows: .\scripts\setup.ps1

# 用已就绪的环境直接启动（不做前置检查）
./scripts/dev.sh            # 或分别 uvicorn / vite

# 后端测试（临时数据目录，不动 data/）
cd backend && ../.venv/bin/python -m pytest -q     # 基线 339 passed

# 前端
cd frontend && npm run build    # tsc --noEmit + vite build，0 错误
cd frontend && npm test         # 165 passed, 5 skipped
```

> 迁移时若 InteFlow 还没有 `.venv`，可临时借用 `SATeacher/.venv/bin/python` 跑 pytest 验证。

## 8. 关键文件索引

| 路径 | 作用 |
|---|---|
| `backend/app/main.py` | FastAPI 装配（`/api/health`、13 个 router） |
| `backend/app/db.py` | SQLite 连接 / `SCHEMA` / `_migrate` / 路径常量（`ifmd_path()`） |
| `backend/app/dictionary/` | Eudic `.eudb` 解析 + 派生 SQLite 索引 + 本地查词；构建时拆分词条内的 Definition for English Learners 栏目 |
| `backend/app/vocab_assist.py` | 拖词选义：词性/首义提取、候选（自定义词典 + 韦氏/learner 栏目）、可选 LLM 选义、回退与警告 |
| `backend/app/repos/custom_dictionary.py` · `backend/app/api/custom_dictionary.py` | 用户自定义词典：CRUD、CSV/TSV/JSON/TXT 导入、查词与候选 |
| `frontend/src/components/CustomDictionaryManager.tsx` | Settings 里的自定义词典导入/新增/删除弹窗 |
| `backend/app/word_exam.py` | 单词考试核心：从词表抽题、本地宽松判分（拼写/释义）、可选 AI 严格判分（参考词表 + 韦氏）与回退 |
| `backend/app/repos/subjects.py` · `backend/app/api/subjects.py` | 学科分类：CRUD（名称大小写不敏感去重、调色板）+ 试卷归属；删除学科回退 Uncategorized |
| `backend/app/repos/review.py` · `backend/app/api/review.py` | 错题集（最近一次错题去重）+ 精选题集（`question_stars`）+ 星标接口；分析/科目/作答一起返回 |
| `backend/app/imports.py` | 导入流水线服务：detect → convert → commit（0 token；AI 兜底受设置开关控制） |
| `backend/app/convert/pdf.py` | PyMuPDF → InteFlow-MD（含 OCR 分支、无选项 → 填空） |
| `backend/app/convert/paired.py` | 双篇识别：`Text 1`/`Text 2`（兼容 `Passage 1/2`）→ material + material2 |
| `backend/app/convert/twocolumn.py` | 双栏版面 profile（原 bluebook.py） |
| `backend/app/convert/docx.py` | DOCX → InteFlow-MD（zip 安全校验） |
| `backend/app/ifmd/parser.py` · `writer.py` | InteFlow-MD 解析 / 回写（确定性状态机；多选/填空/多答案） |
| `backend/app/sections.py` | 板块标签（`label()` / `DEFAULT_SECTION`） |
| `backend/app/api/` | documents · imports · builtin · sessions · settings · ai · **analysis** · **dictionary** · **custom_dictionary** · **vocabulary** · **word_exam** · **subjects** · **review** |
| `backend/app/repos/` | documents · imports · sessions · **analyses** · words（grid v2 + 结构化词条） · **custom_dictionary** · **subjects** · **review** · settings |
| `backend/app/export/` | PDF / DOCX / **notebook（复盘笔记本）** / 数学公式桥接 |
| `backend/app/builtin/` | 内置题库（44 单元，随仓库分发） |
| `frontend/src/pages/` | ExamHome · **Library(Import)** · **Sessions** · **Review (MistakesPage)** · **Vocabulary** · AnswerKey · **Practice** · Result · Settings |
| `frontend/src/components/ui/AppSidebar.tsx` | 工作区左侧栏（6 tab，移动端抽屉；桌面 Compact 图标栏，存 `inteflow.sidebar.compact`） |
| `frontend/src/components/PassageText.tsx` | 文章/双篇材料渲染（单篇 `Passage`，双篇 `Text 1`/`Text 2`，保留诗歌换行） |
| `frontend/src/index.css` | 设计令牌 + `@theme`；主题层：`.app-theme[data-theme=…]` 语义变量 → Tailwind 颜色族映射 + 各主题特征样式 |
| `frontend/src/theme.ts` | 主题注册表（id / 名称 / 说明 / 色板）+ `localStorage` 持久化 + `useTheme()`；`components/ui/ThemePicker.tsx` 是 Settings 里的选择器 |
| `frontend/src/components/workspace/` | 复盘工作台（Workspace **2-of-5** 分屏 / WorkspacePane 切换器 / QuestionNav / AnalysisEditor / AiTutorPane / VocabularyPane / **DictionaryPane** / ExportDrawer / NotebookPreview / VocabGrid / **WordExamPanel / WordExamResultView** / Splitter / usePersistentLayout） |
| `frontend/src/lib/sections.ts` | 前端板块标签（与后端 `sections.py` 对齐） |
| `frontend/src/lib/i18n.tsx` · `components/ui/LanguagePicker.tsx` | 前端中英文案表 / `I18nProvider` / `useI18n` / `useT` + Settings 里的语言切换（`inteflow.language`） |
| `frontend/src/lib/wordExamQr.ts` | 单词考试分享 payload + 多段 QR 分块（`IFWT1|id|part/total|`） |
| `frontend/src/components/SubjectControls.tsx` · `frontend/src/lib/subjects.ts` | 学科徽章/筛选/行内选择（可现场创建并归类）/管理弹窗 + 调色板映射 |
| `website/` | 项目官网（静态多页 HTML/CSS/JS：`index.html` / `en.html` 首页 = hero + 三张安装包卡片 + 三栏 highlights + 收尾 CTA，`download*.html` 平台安装包 + 首次打开说明 + 开发者源码小节，`features*.html` 两条原则 + 五步工作流 + 六项核心能力 + 可折叠的 22 项完整索引 + 架构 + FAQ，`demo*.html` 四个演示页（做题 / 2-of-4 工作区 / 错题集 / 生词集），`themes*.html` 主题预览；`assets/site.js` 的 `DEMO` 保存中英题目、错题与词库，`assets/downloads.js` 读取最新 GitHub Release 并升级平台直链；样式集中在 `assets/site.css`） |
| `.github/workflows/pages.yml` | GitHub Pages 部署：push 到 main 时发布 `website/` |
| `.github/workflows/desktop.yml` | 桌面端 CI/CD：`main` push 构建 artifact；`v*` tag 打包 macOS arm64/x64 DMG 与 Windows x64 NSIS 并发布 Release；打包后跑 `verify_bundle.py` |
| `desktop/main.cjs` · `desktop/preload.cjs` | Electron 主进程（起后端、PDF 桥、菜单、**Reset local data** IPC）与最小 preload 桥（`window.inteflow.resetData()`） |
| `desktop/verify_bundle.py` | 校验打包资源不含 `app.db` / `mw.db` / `.eudb` / `data/`，保证官网下载到的应用是纯空安装 |
| `docs/DESKTOP.md` | 桌面端下载、数据位置、纯空安装保证、Reset、本地构建与 CI 说明 |
| `scripts/build_builtin.py` | 内置题库离线构建脚本 |
| `docs/examples/simple-math.ifmd.md` | 可直接导入的 10 题简单数学 demo（单选 / 多选 / 填空 / 材料题 / 公式） |
| `start.sh` / `start.ps1` | 一键启动：前置检查 + 缺则 setup + 起前后端 + 等健康 + 开浏览器；`start.bat` 为 Windows 双击入口（源码运行，非桌面安装包） |

## 9. 工作约定

- 保持与前身一致的代码风格 / 命名 / 目录结构。
- **改动重要文件后要复核**（read/grep 确认落盘）。
- 新增功能必须补测试，且不得破坏现有基线。
- `docs/legacy/` 是历史文档，**不要**在此基础上改规格；新规格写进 `docs/` 与 `README*`。
- 用户在 [`docs/IDEAS.md`](docs/IDEAS.md) 里记录改动想法，做功能前先看它。
