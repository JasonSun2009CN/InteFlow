# IDEAS — 修改想法记录

> 这份文档给**维护者**随手记录对 InteFlow 的改动想法、体验反馈、待办灵感。
> 不需要写得很正式：一句话也行。AI agent 在做功能前会先读这里。
>
> 约定：
>
> - 每条想法用一个小节（或一个列表项），标上 **状态** 与 **优先级**（可选）。
> - 状态建议用：`💡 想法` / `🔜 待做` / `🚧 进行中` / `✅ 已完成` / `❌ 放弃`。
> - 已经形成明确规格的，写进 `ROADMAP.md` 或对应 `docs/`，这里只留索引即可。

---

## 我的想法

<!-- 从这里开始往下写 -->

### ✅ 加入单词考试功能（2026-10-20）

- purpose: 用于测试单词背诵效果
- usage: 选择单词表，选择考试模式，开始测试，生成测试结果和二维码，二维码信息包括正确率和考察的单词范围，每个单词的正确答案的用户答案
- position：开在vocabulary栏中，一个是查看单词表，一个是单词测试
- 测试量：设定单词数量/全测
- 考试模式： 中译英(拼写)，英译中
- 方案1：调用模型API
    会消耗tokens
- 方案2：和单词表中完全相同对应
- **已实现（2026-10-20）**：Vocabulary 页顶部 **Word list / Word test** 两 tab。
  - 抽题：从当前试卷词表随机抽取；可输入数量或全测（上限 500）。中译英题面用 Meaning 列，
    为空时回退本地韦氏词典首义；英译中题面是英文单词。正确答案只留在后端，提交后才返回。
  - 本地判分（默认，0 token）：中译英拼写忽略大小写/空格/标点，Word 列可用 `;` `/` `|` 换行分隔多个可接受拼写；
    英译中使用宽松匹配（精确 / 分段 / 足够长的子串 [≥40%] / 多词 token 包含）。
  - AI 判分：Settings 的 `vocab_exam_ai_grading` 默认关闭；开启后提交时参考「词表释义 + 韦氏词典」严格判分两种模式，
    每 20 题一批；无 key / 调用失败 / 返回不可解析时回退本地并在结果里提示。
  - 结果页：正确率、考察范围、逐题正确答案/用户答案；同时生成**紧凑 JSON 二维码**
    （含正确率、考察单词位置、每题 expected/response）。题量大时自动拆成多个 QR，
    每块前缀 `IFWT1|<id>|part/total|`，另提供 `.json` 下载。
  - 代码：`backend/app/word_exam.py` + `backend/app/api/word_exam.py`；
    前端 `WordExamPanel` / `WordExamResultView` / `lib/wordExamQr.ts`；测试覆盖见
    `backend/tests/test_word_exam.py`、`WordExamPanel.test.tsx`、`wordExamQr.test.ts`。

### ✅ 不同themes

- 在 Settings → Appearance 中设置（存 `localStorage`，键 `inteflow.theme`）
- **已实现（2026-10-19）**，5 套主题全部落地：
  Clear Blue（默认，即原 "CB Classic" 改名）/
  Paper & Ink / Minimal Light / Midnight Navy / Warm Editorial。
  实现见 `frontend/src/theme.ts` + `frontend/src/index.css` 的主题层
  （`.app-theme[data-theme=…]`）。
- **全屏练习页不跟随主题**（保留原 slate/blue），复盘页跟随。
- 设计预览（纯 HTML/CSS/JS，无依赖）保留在 [`theme-examples/`](theme-examples/README.md)：
  每页渲染同一个主页，只换视觉；打开 `theme-examples/index.html` 可看实时对比。
- 预览里首页统计数字的**递增动画**（0 → 目标值，ease-out 600ms）已照搬到真机首页：
  `frontend/src/lib/useCountUp.ts`；每次页面加载只播一次，`prefers-reduced-motion` 下跳过，
  并有超时兜底确保最终一定落在真实数字上。

### ✅ 填空题

- 添加填空题功能
- 已完成（2026-10-19）：导入时未识别到选项即按填空题处理；答案录入页可用加号添加多个可接受答案。

### ✅ 多答案

- 多答案功能
- 已完成（2026-10-19）：选择题头部 `multi=1` 支持多选，答案存 `A,C`；练习页与批量录入均支持。

### ✅ 复盘（分析模式）重构

- 进入复盘隐藏左侧栏、全屏；题号导航缩到左上角点击展开；左侧题面 + 右侧 Pages 式分析编辑器；分析可保存续写并导出 md/docx/pdf。

### ✅ 复盘解析的加载与预览（2026-10-19）

- 修复：重新打开某次作答时，分析页在 notebook 异步加载完成后仍是空白（已保存内容不显示）。
- Preview 用 `remark-breaks` 保留单换行；离开/切题时补存最后不到 0.9 秒的输入。
- 复盘页顶部新增 **Notebook**：整套解析全屏预览（试卷标题 → 已写解析题目的题干/图表/解析），并可直接导出 md/docx/pdf（只含已写解析的题）。

### ✅ 作答历史

- 左侧栏在 Exams 与 Library 之间加了 Sessions 页：按做题时间倒序，可搜索、可删除。

### ✅ 设置

- 新增"用户名"（导出封面用）与"题目识别 API 兜底"开关。

### ✅ 生词本 + 本地韦氏词典（2026-10-19）

- 复盘工作台改为 **题目 / 分析 / AI Tutor / 生词本 四选二分屏**；每侧可切到另外三者，选择已在另一侧的工具则交换，默认左题目右分析。
- 从题目或选项里**选中单词拖到生词本 pane**：本地韦氏词典查候选，AI 只在真实候选里选最贴合上下文的释义；无 key/失败回退第一条释义并提示；无词条也照样入表。
- 左侧栏 **Vocabulary** 页：左侧考试索引 + 右侧词表编辑器（手动增改、查词、按条添加、导出 xlsx）。每套试卷一份词表，按词去重。
- `.eudb` 本地解析，首次查词自动建索引 `data/dictionary/mw.db`（92,006 条）；
  只显示英英原文，0 token；`dictionary/` 版权文件已 gitignore。
- 2026-10-20：Settings 增加 `vocab_ai_sense`（关闭后拖词不调用 LLM）与
  `vocab_learner_definitions`。后者不是另一本 learner 词典，而是韦氏词条内部的
  **Definition for English Learners** 栏目：构建索引时拆到 `learner_definition`，
  有就优先、没有回退普通释义。当前这份 `韦氏大辞典.eudb` 实测 `learner_count = 0`
  （未带该栏目），所以会回退普通释义；换成含该栏目的版本后会自动使用。
- 在这套词表/词性/释义数据上的“单词考试”（中译英、英译中）已实现，见下方 ✅ 条目。

### ✅ 添加“需复习题目”的功能（2026-10-20）

- 把mistake界面分开成两部分，一半放错题，一般放用户标记的题目
- 设想：mistake界面换个名字，然后在mistake里面分categories，支持按时间顺序排，支持搜索套题和题干、选项的内容。
- 要显示题目的分析（如果有的话），如果有多个分析的话都显示
- **已实现（2026-10-20）**：侧栏 **Mistakes → Review**，页内 **Mistakes / Starred** 两 tab。
  - Mistakes：所有已提交作答的错题，按题去重，保留**最近一次**作答；后来做对自动移出。
  - Starred（精选题集）：`question_stars` 持久化；练习页、复盘工作台、错题列表都可点星/取消，立即保存。
  - 搜索套题/题干/选项/答案；按 exam 过滤；Newest/Oldest 时间排序。
  - 右侧复用复盘分析编辑器；`analysis_pages` + legacy `analyses` 若有多条，旧分析全部只读列出。
  - 代码：`backend/app/repos/review.py` + `backend/app/api/review.py`；前端 `pages/MistakesPage.tsx`
    Practice/Workspace 星标；测试见 `test_review.py`、`MistakesPage.test.tsx`。

### ✅ 学科题目分类（2026-10-20）

- 支持用户给套题进行学科分类：EG SAT Math
- 在题目栏中进行categorize
- **已实现（2026-10-20）**：全局自定义学科（名称 + 颜色），每套试卷最多一个学科。
  - Library 每行内联 **Subject** 下拉：选已有学科，或 `+ New subject…` 现场创建并自动归类；
    上传框上方可预选本次导入的学科；**Manage subjects** 支持改名/换色/删除。
  - Answer-key 页顶部也能直接改学科；Exams 首页显示学科徽章，并可按学科/Uncategorized 筛选。
  - 删除学科只把试卷移回 Uncategorized，不影响题目、答案、分析或词表；名称大小写不敏感去重，0 token。
  - 代码：`backend/app/repos/subjects.py` + `backend/app/api/subjects.py` +
    `PATCH /api/documents/{id}`；前端 `SubjectControls.tsx` + `lib/subjects.ts`；
    `subjects` 表 + `documents.subject_id`（自动迁移）。

### ✅ 用户自定义词典（2026-10-20）

- 导入词典
- 选择词典
- **已实现（2026-10-20）**：Settings → **My dictionary** 可导入 CSV / TSV / JSON / TXT，也可手动增删词条。
  - 词条存 `app.db` 的 `custom_dictionary_entries`（word/pos/definition，word_key 唯一），全局共享。
  - 设置 `custom_dictionary_enabled` 默认开：查词先查自定义词典，未命中再回退韦氏；拖词候选、逐条添加、
    单词考试释义引用也优先使用。
  - 代码：`backend/app/repos/custom_dictionary.py` + `backend/app/api/custom_dictionary.py`；
    前端 `components/CustomDictionaryManager.tsx`；测试 `test_custom_dictionary.py`。
