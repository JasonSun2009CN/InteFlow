# AGENT.md — InteFlow 项目交接与工作说明

> 面向后续会话 / AI agent / 贡献者。**项目状态变化后请同步更新本文件。**
> 配套文档：[`README.md`](README.md)（英文）、[`README-cn.md`](README-cn.md)（中文）、
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/IFMD.md`](docs/IFMD.md)、
> [`docs/IDEAS.md`](docs/IDEAS.md)（修改想法记录）、[`ROADMAP.md`](ROADMAP.md)。

---

## 1. 项目是什么

本地优先的学习工作流 Web 应用：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件**。

- 技术栈：FastAPI + React（Vite / TypeScript / Tailwind 4）+ SQLite 单文件；PyMuPDF 转换；
  WeasyPrint（PDF）/ python-docx（DOCX 导入 + 导出）；OCR = 系统 `tesseract`（可选）或 macOS Vision（可选）。
- 前身：`SATeacher`（叫 **SATeacher**，一个 SAT 刷题工具）。
  本项目在其基础上**全量迁移 + 改名 + 逐步泛化/打磨**。前身的历史规划文档保留在
  [`docs/legacy/`](docs/legacy)（**仅作参考**，不要当成 InteFlow 的当前规格）。

## 2. 两条铁律（不变量）

1. **LLM 不在主链路**：导入/解析/判分/导出全部确定性本地计算，**0 token**；只有用户显式点击
   （AI 讲解 / 连通性测试 / 在设置里开启 AI 评分后的单词考试提交）才调用外部 API。
2. **本地优先**：所有数据在 `data/`（SQLite + 每篇文档的 `doc.ifmd.md` 与图片），不上传云端。
3. 界面默认英文，可在 **Settings → Language** 切换为中文（全前端 i18n，0 token；考试原文、用户内容与后端报错保持原样）；与维护者交流用中文；**有疑问必须先用 `question` 工具问，不许自己猜**。

## 3. 当前状态（2026-10-21）

| 项 | 值 |
|---|---|
| 后端测试 | `pytest` **309 passed, 1 skipped** |
| 前端类型检查 + 构建 | `npm run build` **0 错误** |
| 前端组件测试 | `npm test` **145 passed, 5 skipped** |
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
> 2026-10-22：**官网在线演示 + 下载 ZIP**。中英双语落地页新增 `#demo` 区块：4 道示例题（态度 / 词义 /
> 代数 / 填空），可选题号、标记待看、计时与交卷；成绩页可进入复盘（正确答案、示例解析、可收藏生词）。
> 判分、计时与生词收藏都在浏览器内完成（生词存 `localStorage` 键 `inteflow.website.demo.vocab`），0 token。
> 题目与双语文案在 `website/assets/site.js` 的 `DEMO` 对象，样式在 `site.css`。Hero、Demo 与 Quick start
> 都加了 **Download ZIP**，指向 GitHub 的 `archive/refs/heads/main.zip`（压缩包不随网站入库）。
>
> 2026-10-21：**复盘工作台工具切换器改为图标按钮行**。原来每个 pane 头部是一个 “Switch…” 下拉菜单，
> 现在改为横向排列的**四个图标 + 小字标签**按钮（Question / Analysis / AI Tutor / Vocabulary，Lucide 图标），
> 当前工具高亮（`aria-pressed`），另一侧的工具略淡并提示 “click to swap”；点另一个 pane 已有的工具仍按原逻辑
> 左右互换。纯前端改动，未改任何接口 / 存储格式。

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

## 6. 待办 / 已知缺口

### 本次迁移之后要做的
1. ~~**计时方案**~~ **已实现（2026-10-22）**：开始屏可选正计时/倒计时；倒计时手输分:秒，到 0 自动交卷；
   默认值按试卷读取上次提交的计时方式（无记录回退全局最近一次）。详见 §5。
2. ~~**查词（占位）**~~ **已实现（2026-10-19/20）**：本地 Merriam-Webster（Eudic `.eudb`）索引 + 查词接口 + Vocabulary 页 + 复盘拖词选义；词条内 Definition for English Learners 栏目可优先使用；用户自定义词典可在 Settings 导入/维护并优先查词。
3. ~~**错题分析导出（占位）**~~ **已实现（2026-10-19）**：一套试卷一套分析笔记本，可导出 md/docx/pdf 并留副本到 `data/exports/`；复盘页 Notebook 可先预览整套解析，导出只包含已写解析的题。单词表导出仍是 xlsx。
4. **UI/UX 打磨**（用户逐页审查）：已完成——左侧栏 6 tab 工作区（窄屏抽屉）+ 纸墨风同步 + 复盘页全屏重构
   （2026-10-19）。继续审查中：练习界面、复盘工作台（分析编辑器/导航/抽屉）的细节可能还要微调。
5. ~~**Mistakes 仍是占位页**~~ **已实现（2026-10-20）**：侧栏改名 **Review**，内含 **Mistakes**（按题去重保留最近作答）与 **Starred**（精选题集）；支持搜索、exam 过滤、时间排序、分析查看/编辑。Vocabulary 已完成；**单词考试**与**学科分类**均已完成。

### 泛化的尾项
- `guess_sec()` 的启发式仍是 SAT 调参（`rw`/`math` 信号）；无标题时回退到
  `INTEFLOW_DEFAULT_SECTION`（默认 `rw`）。非 SAT 题库可显式写 `sec=...`，或改这个环境变量。
- `docs/legacy/` 里的规划文档含 SAT 语境，仅作参考。

## 7. 运行与验证命令

```bash
# 一键启动（缺环境先 setup + 起前后端 :8000/:5173 + 开浏览器）
./start.sh                  # Windows: .\start.ps1（双击 InteFlow.command / start.bat）

# 只建环境（幂等，不启动）
./scripts/setup.sh          # Windows: .\scripts\setup.ps1

# 用已就绪的环境直接启动（不做前置检查）
./scripts/dev.sh            # 或分别 uvicorn / vite

# 后端测试（临时数据目录，不动 data/）
cd backend && ../.venv/bin/python -m pytest -q     # 基线 309 passed, 1 skipped

# 前端
cd frontend && npm run build    # tsc --noEmit + vite build，0 错误
cd frontend && npm test         # 145 passed, 5 skipped
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
| `frontend/src/index.css` | 设计令牌 + `@theme`；主题层：`.app-theme[data-theme=…]` 语义变量 → Tailwind 颜色族映射 + 各主题特征样式 |
| `frontend/src/theme.ts` | 主题注册表（id / 名称 / 说明 / 色板）+ `localStorage` 持久化 + `useTheme()`；`components/ui/ThemePicker.tsx` 是 Settings 里的选择器 |
| `frontend/src/components/workspace/` | 复盘工作台（Workspace 2-of-4 分屏 / WorkspacePane 切换器 / QuestionNav / AnalysisEditor / AiTutorPane / VocabularyPane / ExportDrawer / NotebookPreview / VocabGrid / **WordExamPanel / WordExamResultView** / Splitter / usePersistentLayout） |
| `frontend/src/lib/sections.ts` | 前端板块标签（与后端 `sections.py` 对齐） |
| `frontend/src/lib/i18n.tsx` · `components/ui/LanguagePicker.tsx` | 前端中英文案表 / `I18nProvider` / `useI18n` / `useT` + Settings 里的语言切换（`inteflow.language`） |
| `frontend/src/lib/wordExamQr.ts` | 单词考试分享 payload + 多段 QR 分块（`IFWT1|id|part/total|`） |
| `frontend/src/components/SubjectControls.tsx` · `frontend/src/lib/subjects.ts` | 学科徽章/筛选/行内选择（可现场创建并归类）/管理弹窗 + 调色板映射 |
| `website/` | 项目官网（静态 HTML/CSS/JS；`index.html` 中文 + `en.html` 英文，页头切换；`assets/site.css` + `assets/site.js`；`themes/` 是 5 套主题预览页；`#demo` 是浏览器内可交互练习演示，`site.js` 的 `DEMO` 保存中英题目与文案） |
| `.github/workflows/pages.yml` | GitHub Pages 部署：push 到 main 时发布 `website/` |
| `scripts/build_builtin.py` | 内置题库离线构建脚本 |
| `start.sh` / `start.ps1` | 一键启动：前置检查 + 缺则 setup + 起前后端 + 等健康 + 开浏览器；`InteFlow.command` / `start.bat` 为双击入口 |

## 9. 工作约定

- 保持与前身一致的代码风格 / 命名 / 目录结构。
- **改动重要文件后要复核**（read/grep 确认落盘）。
- 新增功能必须补测试，且不得破坏现有基线。
- `docs/legacy/` 是历史文档，**不要**在此基础上改规格；新规格写进 `docs/` 与 `README*`。
- 用户在 [`docs/IDEAS.md`](docs/IDEAS.md) 里记录改动想法，做功能前先看它。
