# InteFlow — ROADMAP

> 本地优先的学习工作流：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件。**
>
> 状态快照：**2026-10-20** ｜ pytest **296 passed, 1 skipped** ｜ `npm run build` 0 错误 ｜ `npm test` 135 passed, 5 skipped。
> 相关文档：[`README.md`](README.md) · [`README-cn.md`](README-cn.md) · [`AGENT.md`](AGENT.md) ·
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/IFMD.md`](docs/IFMD.md) · [`docs/IDEAS.md`](docs/IDEAS.md)

---

## 0. 指导原则（不变量）

1. **LLM 不在主链路**：导入/解析/判分/导出默认确定性本地计算，**0 token**；AI 只在显式操作时调用（AI 讲解、连通性测试、设置开启后的单词考试提交）。
2. **本地优先**：数据全在 `data/`，无云依赖。
3. **正确答案不出后端**：练习接口剥离 `answer`；仅提交/复盘返回。
4. **界面全英文**；与维护者交流用中文；有疑问先问、不猜测。
5. **不局限于 SAT**：板块是自由标签，任意"带题号 + 四选项"的题库都能用。

---

## 1. 已完成（迁移基线，2026-10-19）

- ✅ **从 SATeacher 全量迁移**：后端 + 前端 + 测试 + 内置题库 + OCR + CB 规范化 + 导出。
- ✅ **全量改名**（`SATeacher→InteFlow`、`satmd→ifmd`、`.sat.md→.ifmd.md`、`bluebook→twocolumn` 等，见 [`AGENT.md`](AGENT.md) §4）。
- ✅ **板块泛化**：`sec` 去掉 `CHECK` 约束，成为自由标签；后端 `app/sections.py` + 前端 `lib/sections.ts` 统一显示标签；结算页按"实际出现的板块"动态出卡片。
- ✅ 文档：英文 `README.md` + 中文 `README-cn.md` + `AGENT.md` + `docs/IDEAS.md` + `docs/IFMD.md` + 本文件。
- ✅ **工作区导航重构（2026-10-19）**：左侧栏 6 个 tab（Exams / Library / **Sessions** / **Review** / Vocabulary / Settings，窄屏抽屉）；
  Review 已实现错题集与精选题集（原 Mistakes 占位页已替换）；桌面端侧栏可收缩为 80px 纯图标 Compact 栏，状态存 `inteflow.sidebar.compact`。
- ✅ **主题系统（2026-10-19）**：5 套主题（Clear Blue 默认 / Paper & Ink / Minimal Light / Midnight Navy / Warm Editorial）
  在 Settings → Appearance 切换、存 `localStorage`；`.app-theme[data-theme=…]` 重映射颜色变量 + 特征样式，全站同步，
  **全屏练习页保持原 slate/blue 不跟随**。
- ✅ **复盘（分析模式）重构（2026-10-19）**：进入复盘隐藏侧栏、全屏；题号导航缩到左上角点击悬浮展开（All/Wrong/Correct）；
  左侧题面 + 右侧 Pages 式分析编辑器（Write/Preview、防抖自动保存、⌘S）；一套试卷一套笔记本（`analysis_pages` 一题一页），
  可导出 md/docx/pdf 并在 `data/exports/` 留副本；AI / 单词表 / 导出收进工具栏抽屉。
- ✅ **题型扩展（2026-10-19）**：多答案选择题（`multi=1`，答案 `A,C`）+ 填空题（`kind=blank`，多个可接受答案 `a | b`）；
  导入时未识别到选项按填空处理；设置里加"题目识别 API 兜底"开关与"用户名"。
- ✅ **作答历史 + 删除**：Sessions 页按时间倒序列出每次作答，可搜索、可删除（`GET/DELETE /api/sessions`）。**只有提交过（submit）的作答才记录**；打开考试不产生记录。
- ✅ **生词本 + 本地韦氏词典（2026-10-19/20）**：Vocabulary 页 = 左侧考试索引 + 右侧词表编辑器（手动增改、查词、按条添加、导出 xlsx）；
  复盘工作台拖词入生词本，本地 `.eudb` 解析成 SQLite 索引（标准 + 可选学习者词典，0 token），可选 AI 在真实候选里选义。
- ✅ **单词考试（2026-10-20）**：Vocabulary 页顶部 **Word list / Word test** 两 tab。从当前词表随机抽题（手输数量或全测）；
  模式 **English → Chinese**（手写释义，本地宽松匹配）与 **Chinese → English**（看释义拼写，忽略大小写/空格/标点）。
  结果含正确率、考察范围、每题正确答案/用户答案 + 紧凑 JSON 二维码（大卷拆多个 QR，另可下载 `.json`）。
  Settings 的 `vocab_exam_ai_grading` 默认关，开启后提交时 AI 参考词表 + 韦氏释义严格判分，失败回退本地。
- ✅ **学科分类（2026-10-20）**：用户自定义学科（名称 + 颜色），每套试卷最多归属一个；Library 行内下拉即可归类，
  也能现场新建；Answer-key 页顶部同样可改；Library 提供 **Manage subjects** 与学科过滤，Exams 首页显示学科徽章与筛选。
  删除学科只把试卷移回 Uncategorized，不影响题目/答案/分析/词表；0 token。
- ✅ **Review：错题集 + 精选题集（2026-10-20）**：侧栏 **Review** 页内分 **Mistakes / Starred**。
  错题按题去重并保留最近一次作答（后来做对自动移出），精选题来自练习/复盘/错题列表里点的星（`question_stars`）。
  两栏用顶部滑动分段控件切换，支持按套题/题干/选项搜索、exam 过滤、时间正/倒序，复用分析编辑器查看/编辑；旧分析也一并只读列出。0 token。
- ✅ **移除 Normalize**：前端入口与后端接口/任务/测试全部删除（`convert/normalize.py` 文本清洗工具保留）。

### 沿用前身（已实现，直接可用）
导入（PDF/DOCX/Markdown/OCR/流水线/内置题库）· 答案录入（网格 + 批量粘贴）·
练习（全屏、计时、题号导航、标记、键盘、多选/填空）· 结果复盘（全屏工作台 + 折叠导航 + 分析编辑器 + 过滤 + regrade）·
工作区（手写解析 / 词汇表 v2 / AI 讲解 / 导出入口）· 导出（PDF / DOCX / 生词 xlsx）·
设置（19 家 LLM 服务商目录 + 用户名 + AI 兜底/生词本/单词考试评分开关）· 整套解析 Notebook 预览与导出 · 学科分类 · 错题集/精选题集 · 测试（pytest 296 / vitest 135）。

---

## 2. 待办（按优先级）

| 优先级 | 事项 | 说明 | 状态 |
|---|---|---|---|
| P0 | **计时方案：正计时 / 倒计时** | `PracticePage` 现仅正计时；需加倒计时模式（开始屏选择 + 手输 `mm:ss` + 记住上次）。倒计时归零行为待定 | 🔜 |
| P0 | **UI/UX 打磨** | 用户逐页审查：① 练习界面 ② 复盘工作台（导航/编辑器/抽屉）；侧栏 6 tab + 纸墨风 + 复盘全屏重构已落地（2026-10-19）；桌面侧栏 Compact 图标栏已落地（2026-10-20） | 🔜 |
| P1 | ~~**Review tab：错题分析 + 精选题集**~~ | 侧栏 Review：Mistakes 按题去重保留最近作答；Starred 为用户标记题；搜索/过滤/排序 + 分析编辑 | ✅ 已完成 |
| P1 | ~~**Vocabulary tab：单词整理集合**~~ | 一套试题一份词表，重刷同卷时在原表增改；已含词表编辑、拖词与 **Word test** | ✅ 已完成 |
| P1 | ~~**查词**~~ | 应用内本地韦氏词典查询（标准 / 学习者索引，0 token） | ✅ 已完成 |
| P1 | ~~**错题分析导出**~~ | 一套试卷一套分析笔记本，导出 md/docx/pdf 并存 `data/exports/` | ✅ 已完成 |
| P2 | 非 SAT 会话的 section 统计与文案进一步中性化 | 启发式 `guess_sec` 仍偏 SAT | 💡 |
| P2 | 导出封面 / 水印 / 目录（>20 题 question index） | 前身遗留增量 | 💡 |
| P2 | AI 解析结果"来源 + 时间"标注 | 前身遗留 M7 | 💡 |

> 详细想法记录见 [`docs/IDEAS.md`](docs/IDEAS.md)。

---

## 3. 明确的"暂不做"

- 云同步 / 账号体系 / 多人协作（本地优先，单用户）。
- 错题本 SRS 复习（`vocab` 表预留，未排期）。
- 学生答题页暴露答案或 AI 内部判断（永不）。

---

## 4. 验收与命令

```bash
cd backend && ../.venv/bin/python -m pytest -q   # 296 passed, 1 skipped
cd frontend && npm run build                     # 0 错误
cd frontend && npm test                          # 135 passed, 5 skipped
./scripts/dev.sh                                 # 后端 :8000 + 前端 :5173
```
