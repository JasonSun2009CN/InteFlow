# InteFlow — ROADMAP

> 本地优先的学习工作流：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件。**
>
> 状态快照：**2026-10-19** ｜ pytest **187 passed, 1 skipped** ｜ `npm run build` 0 错误 ｜ `npm test` 49 passed, 5 skipped。
> 相关文档：[`README.md`](README.md) · [`README-cn.md`](README-cn.md) · [`AGENT.md`](AGENT.md) ·
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/IFMD.md`](docs/IFMD.md) · [`docs/IDEAS.md`](docs/IDEAS.md)

---

## 0. 指导原则（不变量）

1. **LLM 不在主链路**：导入/解析/判分/导出确定性本地计算，**0 token**；AI 只在显式点击时调用。
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
- ✅ **工作区导航重构（2026-10-19）**：左侧栏 5 个 tab（Exams / Library / Mistakes / Vocabulary / Settings，窄屏抽屉）；
  纸墨风主题作用于除练习页外的全部页面（`.paper-app` 重映射颜色变量）。`Mistakes` / `Vocabulary` 暂为占位页。

### 沿用前身（已实现，直接可用）
导入（PDF/DOCX/Markdown/OCR/流水线/内置题库）· 答案录入（网格 + 批量粘贴）·
练习（全屏、计时、题号导航、标记、键盘）· 结果复盘（三栏工作台 + 过滤 + regrade）·
工作区（手写解析 / 词汇表 v2 / AI 讲解 / 导出入口）· 导出（PDF / DOCX / 生词 xlsx）·
设置（16 家 LLM 服务商目录）· 测试（pytest 187 / vitest 49）。

---

## 2. 待办（按优先级）

| 优先级 | 事项 | 说明 | 状态 |
|---|---|---|---|
| P0 | **计时方案：正计时 / 倒计时** | `PracticePage` 现仅正计时；需加倒计时模式（开始屏选择 + 手输 `mm:ss` + 记住上次）。倒计时归零行为待定 | 🔜 |
| P0 | **UI/UX 打磨** | 用户逐页审查：① 练习界面 ② 复盘/结算工作台；侧栏 5 tab + 纸墨风已落地（2026-10-19） | 🔜 |
| P1 | **Mistakes tab：错题分析集合** | 汇总所有 session 错题，按题去重（保留最近作答），按试卷/板块过滤；现为占位页 | 💡 占位 |
| P1 | **Vocabulary tab：单词整理集合** | 一套试题一份词表，重刷同卷时在原表增改；现为占位页 | 💡 占位 |
| P1 | **查词** | 应用内词典查询（本地词典 / AI 释义 / 两者，待定） | 💡 占位 |
| P1 | **错题分析导出** | 只导错题 + 解析的文件（格式待定：PDF / DOCX / MD） | 💡 占位 |
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
cd backend && ../.venv/bin/python -m pytest -q   # 187 passed, 1 skipped
cd frontend && npm run build                     # 0 错误
cd frontend && npm test                          # 49 passed, 5 skipped
./scripts/dev.sh                                 # 后端 :8000 + 前端 :5173
```
