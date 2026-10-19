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
   （AI 讲解 / 连通性测试）才调用外部 API。
2. **本地优先**：所有数据在 `data/`（SQLite + 每篇文档的 `doc.ifmd.md` 与图片），不上传云端。
3. 界面全英文；与维护者交流用中文；**有疑问必须先用 `question` 工具问，不许自己猜**。

## 3. 当前状态（2026-10-19）

| 项 | 值 |
|---|---|
| 后端测试 | `pytest` **187 passed, 1 skipped** |
| 前端类型检查 + 构建 | `npm run build` **0 错误** |
| 前端组件测试 | `npm test` **43 passed, 5 skipped** |
| 内置题库 | 44 单元 / 1186 题（`backend/app/builtin/sat2025-rw-b`） |
| API 面 | 27 条（见 `docs/ARCHITECTURE.md`） |

> 本次迁移尚未新增功能（计时方案、查词、错题导出均为**待办**，见 §6）。此节只反映"能跑通 + 已改名/泛化"的基线。

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
| 计时 | 正计时 + 倒计时两种；倒计时**开始屏手输 + 记住上次**（存本地） |
| 查词 / 错题分析导出 | **先做占位**，细节后续再定 |
| 文档语言 | `README.md` 英文、`README-cn.md` 中文、`AGENT.md` 中文、`docs/IDEAS.md` 中文（**不建 CLAUDE.md**） |

## 6. 待办 / 已知缺口

### 本次迁移之后要做的
1. **计时方案**：`PracticePage` 目前只有**正计时**（`useState` + `setInterval`）。
   需要加"倒计时"模式：开始屏选择 + 手输 `mm:ss` + 记住上次（`localStorage`）。
   倒计时到 0 时的行为（自动交卷 / 只提示）**还没定，做之前先问用户**。
2. **查词（占位）**：应用内词典查询。数据源（本地词典 / AI 释义 / 两者）未定。
3. **错题分析导出（占位）**：目前只有整卷 PDF/DOCX 导出与生词 xlsx；"只导错题 + 解析"的文件格式未定。
4. **UI/UX 打磨**（用户逐页审查）：做题界面、结算界面、Library 导航是最需要改的三处。

### 泛化的尾项
- `guess_sec()` 的启发式仍是 SAT 调参（`rw`/`math` 信号）；无标题时回退到
  `INTEFLOW_DEFAULT_SECTION`（默认 `rw`）。非 SAT 题库可显式写 `sec=...`，或改这个环境变量。
- `docs/legacy/` 里的规划文档含 SAT 语境，仅作参考。

## 7. 运行与验证命令

```bash
# 首次建环境（幂等）
./scripts/setup.sh          # Windows: .\scripts\setup.ps1

# 开发（后端 :8000 + 前端 :5173）
./scripts/dev.sh            # 或分别 uvicorn / vite

# 后端测试（临时数据目录，不动 data/）
cd backend && ../.venv/bin/python -m pytest -q     # 基线 187 passed, 1 skipped

# 前端
cd frontend && npm run build    # tsc --noEmit + vite build，0 错误
cd frontend && npm test         # 43 passed, 5 skipped
```

> 迁移时若 InteFlow 还没有 `.venv`，可临时借用 `SATeacher/.venv/bin/python` 跑 pytest 验证。

## 8. 关键文件索引

| 路径 | 作用 |
|---|---|
| `backend/app/main.py` | FastAPI 装配（`/api/health`、6 个 router） |
| `backend/app/db.py` | SQLite 连接 / `SCHEMA` / `_migrate` / 路径常量（`ifmd_path()`） |
| `backend/app/imports.py` | 导入流水线服务：detect → convert → commit（0 token） |
| `backend/app/convert/pdf.py` | PyMuPDF → InteFlow-MD（含 OCR 分支） |
| `backend/app/convert/twocolumn.py` | 双栏版面 profile（原 bluebook.py） |
| `backend/app/convert/docx.py` | DOCX → InteFlow-MD（zip 安全校验） |
| `backend/app/ifmd/parser.py` · `writer.py` | InteFlow-MD 解析 / 回写（确定性状态机） |
| `backend/app/sections.py` | 板块标签（`label()` / `DEFAULT_SECTION`） |
| `backend/app/api/` | documents · imports · builtin · sessions · settings · ai |
| `backend/app/repos/` | documents · imports · sessions · words · settings |
| `backend/app/export/` | PDF / DOCX / 数学公式桥接 |
| `backend/app/builtin/` | 内置题库（44 单元，随仓库分发） |
| `frontend/src/pages/` | ExamHome · Import(Manage) · AnswerKey · **Practice** · Result · Settings |
| `frontend/src/components/workspace/` | 复盘三栏工作台（Workspace / Inspector / QuestionNav / VocabularySheet / VocabGrid / Splitter） |
| `frontend/src/lib/sections.ts` | 前端板块标签（与后端 `sections.py` 对齐） |
| `scripts/build_builtin.py` | 内置题库离线构建脚本 |

## 9. 工作约定

- 保持与前身一致的代码风格 / 命名 / 目录结构。
- **改动重要文件后要复核**（read/grep 确认落盘）。
- 新增功能必须补测试，且不得破坏现有基线。
- `docs/legacy/` 是历史文档，**不要**在此基础上改规格；新规格写进 `docs/` 与 `README*`。
- 用户在 [`docs/IDEAS.md`](docs/IDEAS.md) 里记录改动想法，做功能前先看它。
