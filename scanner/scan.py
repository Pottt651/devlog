"""
Devlog Scanner — 扫描 Claude Code 历史 + Git 日志，推送到 Cloudflare D1
用法: python scan.py
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

QUANT_ROOT = Path(r"C:/Users/汤/Documents/quant")
CLAUDE_HISTORY = Path(r"C:/Users/汤/.claude/history.jsonl")
DEVLOG_ROOT = Path(__file__).parent.parent
D1_DB = "devlog-db"


def run_git(repo_path: Path, *args) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_path)] + list(args),
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30
        )
        return result.stdout.strip()
    except Exception:
        return ""


# 手工补充的项目信息（CLAUDE.md/README.md 缺失或不够清晰的项目）
PROJECT_INFO = {
    "etf-live-trading": {
        "name": "ETF 实盘交易系统",
        "description": "ETF 动量轮动策略的实盘看板 + 信号计算系统。通过 QMT 接入 A 股账户数据，展示持仓、收益、调仓信号。每周五自动计算轮动信号，部署在 Cloudflare Pages 上可随时查看。",
        "links": {"live": "https://etf-live-trading.pages.dev", "github": "https://github.com/Pottt651/etf-live-trading"},
        "tech_stack": ["Python", "Pandas", "AkShare", "Cloudflare Pages", "Supabase"],
        "related_projects": ["fund_huice_codex", "qmt"],
    },
    "ibkr": {
        "name": "IBKR 美股账户终端",
        "description": "盈透证券（Interactive Brokers）美股账户的只读监控终端。通过 Flex Query 获取持仓、交易、收益等数据，FastAPI 后端 + React 前端，Claude.ai 设计风格。支持离线查看历史数据。",
        "links": {"github": "https://github.com/Pottt651/ibkr-terminal"},
        "tech_stack": ["Python", "FastAPI", "React", "TypeScript", "Vite", "SQLite"],
        "related_projects": ["ghostfolio-ibkr"],
    },
    "fund_huice": {
        "name": "ETF 动量回测引擎",
        "description": "ETF 动量轮动策略的回测系统。实现了完整的 Walk-Forward Optimization、Bootstrap 检验、Bonferroni 校正等严格的策略验证流程。v2.1 引擎修复后识别出原策略存在方法论假阳性。",
        "links": {"github": "https://github.com/Pottt651/fund_huice"},
        "tech_stack": ["Python", "Pandas", "NumPy"],
        "related_projects": ["fund_huice_codex"],
    },
    "fund_huice_codex": {
        "name": "ETF 动量回测 + 实盘",
        "description": "ETF 动量轮动策略回测与实盘系统（Codex 协作版）。在 fund_huice 基础上完成策略定型，准备实盘部署。包含回测引擎、信号生成、数据管道等完整链路。",
        "links": {"github": "https://github.com/Pottt651/fund-huice-codex"},
        "tech_stack": ["Python", "Pandas", "NumPy"],
        "related_projects": ["fund_huice", "etf-live-trading"],
    },
    "alphamath_claude": {
        "name": "AlphaMath 数学教学分析",
        "description": "面向上海高中数学教学的数据分析工具。对近三年上海高考、春考、一模二模试卷进行知识点标注、题型分类和趋势分析，用于指导学生备考。Claude Code 深度协作完成。",
        "links": {"live": "https://alphamath-teacher-os.pages.dev", "github": "https://github.com/Pottt651/alphamath-teacher-os"},
        "tech_stack": ["React", "TypeScript", "Vite", "Cloudflare Pages"],
        "related_projects": ["AlphaMath", "erdos"],
    },
    "AlphaMath": {
        "name": "AlphaMath 原型",
        "description": "AlphaMath 项目的早期原型，后续迁移到 alphamath_claude 继续开发。",
        "links": {"github": "https://github.com/Pottt651/AlphaMath"},
        "tech_stack": ["Python", "Flask"],
        "related_projects": ["alphamath_claude"],
    },
    "erdos": {
        "name": "数学试卷数据源",
        "description": "上海数学考试试卷的数据采集与整理项目。从 GitHub 数据源抓取试卷，进行 OCR 识别和规范化命名归档，为 AlphaMath 分析项目提供数据基础。",
        "links": {},
        "tech_stack": ["Python"],
        "related_projects": ["alphamath_claude"],
    },
    "favorites-digest": {
        "name": "收藏夹知识归档",
        "description": "B站和小红书收藏夹内容的转录与知识归档系统。视频通过 Whisper 转录，图文笔记通过 OCR 识别，最终按主题归类整理成个人知识库看板。",
        "links": {},
        "tech_stack": ["Python", "Whisper", "OCR"],
        "related_projects": [],
    },
    "cashpilot": {
        "name": "个人全资产管理",
        "description": "个人可支配资金的全方位管理工具。涵盖投资账户、月度收入、日常开销等所有资金流动。支持数据导入和手动输入，FastAPI + React 全栈架构。项目刚启动。",
        "links": {},
        "tech_stack": ["Python", "FastAPI", "React", "TypeScript", "Vite", "Ant Design"],
        "related_projects": [],
    },
    "nassdaq": {
        "name": "纳指 ETF 相对估值研究",
        "description": "面向 A 股场内纳斯达克100 ETF 的相对估值切换研究。通过 miniQMT 日线数据做代理版相对估值回测，研究 ETF 之间的切换时机和阈值。",
        "links": {},
        "tech_stack": ["Python", "miniQMT"],
        "related_projects": [],
    },
    "qmt": {
        "name": "QMT 量化交易接口",
        "description": "通过 QMT（迅投 miniQMT）接入 A 股券商账户的数据通道。提供持仓查询、交易记录获取、实时行情等功能，作为 etf-live-trading 项目的数据源。",
        "links": {},
        "tech_stack": ["Python", "miniQMT"],
        "related_projects": ["etf-live-trading"],
    },
    "ghostfolio-ibkr": {
        "name": "Ghostfolio 投资组合尝试",
        "description": "尝试使用开源投资组合管理软件 Ghostfolio 来管理 IBKR 账户数据。经评估后放弃，回归自建 ibkr 项目。",
        "links": {},
        "tech_stack": ["Docker", "Ghostfolio"],
        "related_projects": ["ibkr"],
    },
    "devlog": {
        "name": "Devlog 个人开发博客",
        "description": "个人开发博客，自动从 Claude Code 历史和 Git 日志中提取所有 coding 项目摘要，支持日记编辑和 Markdown 导出。Cloudflare Pages + D1 架构，随时随地可访问。",
        "links": {"live": "https://pott1587.xyz", "github": "https://github.com/Pottt651/devlog"},
        "tech_stack": ["React", "TypeScript", "Vite", "Cloudflare Pages", "D1", "Python"],
        "related_projects": [],
    },
    "Kangaroo": {
        "name": "袋鼠数学竞赛工具",
        "description": "袋鼠数学竞赛相关的 Flutter 应用项目。用于数学题目展示和练习。",
        "links": {},
        "tech_stack": ["Flutter", "Dart"],
        "related_projects": ["math_teacher"],
    },
    "math_teacher": {
        "name": "数学教学动画演示",
        "description": "高中数学教学辅助工具。包含模考试卷的 LaTeX 答案解析生成，用于课堂教学和学生备考指导。",
        "links": {},
        "tech_stack": ["LaTeX", "Python"],
        "related_projects": ["Kangaroo", "alphamath_claude"],
    },
}

# 非 quant 目录下的项目路径映射
EXTRA_PROJECT_PATHS = {
    "Kangaroo": Path(r"C:/Users/汤/Documents/Kangaroo"),
    "math_teacher": Path(r"C:/Users/汤/Documents/math_teacher"),
}


def extract_project_info(project_dir: Path, slug: str) -> tuple:
    """从 CLAUDE.md / README.md 提取项目名、简介、链接、技术栈和关联项目，优先使用手工补充信息"""
    # 手工补充优先
    if slug in PROJECT_INFO:
        pi = PROJECT_INFO[slug]
        return pi["name"], pi["description"], pi.get("links", {}), pi.get("tech_stack", []), pi.get("related_projects", [])

    # 尝试从文件提取
    name = slug
    description = ""
    for doc_file in ["CLAUDE.md", "README.md"]:
        doc_path = project_dir / doc_file
        if not doc_path.exists():
            continue
        try:
            text = doc_path.read_text(encoding="utf-8", errors="replace")
            lines = text.split("\n")

            # 提取标题
            for line in lines:
                if line.startswith("#") and not line.startswith("##"):
                    candidate = line.lstrip("#").strip()
                    # 去掉 "CLAUDE.md —" 前缀
                    if "—" in candidate:
                        candidate = candidate.split("—", 1)[1].strip()
                    if candidate:
                        name = candidate
                    break

            # 提取"一句话总结"
            for i, line in enumerate(lines):
                if "一句话总结" in line or "总结" in line:
                    for j in range(i + 1, min(i + 4, len(lines))):
                        candidate = lines[j].strip()
                        if candidate and not candidate.startswith("#") and not candidate.startswith("-"):
                            description = candidate
                            break
                    break

            # fallback: 取第一段非标题、非空行
            if not description:
                for line in lines:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#") and not stripped.startswith(">") and not stripped.startswith("-") and not stripped.startswith("```") and len(stripped) > 20:
                        description = stripped[:200]
                        break

            if name != slug:
                break
        except Exception:
            pass

    # 尝试自动发现 git remote URL
    links = {}
    try:
        remote = subprocess.run(
            ["git", "-C", str(project_dir), "remote", "get-url", "origin"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5
        ).stdout.strip()
        if remote:
            # 转换为 HTTPS 浏览器 URL
            if remote.endswith(".git"):
                remote = remote[:-4]
            links["github"] = remote
    except Exception:
        pass

    return name, description or f"{slug} 项目", links, [], []


def scan_git_projects() -> dict:
    """扫描 quant/ 下所有 git 项目 + 额外项目路径"""
    projects = {}

    # 收集所有要扫描的目录: quant 子目录 + 额外路径
    scan_dirs = []
    for item in sorted(QUANT_ROOT.iterdir()):
        if item.is_dir():
            scan_dirs.append((item.name, item))
    for slug, path in EXTRA_PROJECT_PATHS.items():
        if path.is_dir():
            scan_dirs.append((slug, path))

    for slug, item in scan_dirs:
        if not (item / ".git").exists():
            # 无 git 但在 PROJECT_INFO 中的项目，也加入（作为非 git 项目）
            if slug in PROJECT_INFO:
                name, description, links, tech_stack, related_projects = extract_project_info(item, slug)
                projects[slug] = {
                    "slug": slug,
                    "name": name,
                    "description": description,
                    "status": "paused",
                    "total_commits": 0,
                    "first_commit_at": None,
                    "last_commit_at": None,
                    "files_changed": 0,
                    "lines_added": 0,
                    "lines_removed": 0,
                    "recent_commits": [],
                    "links": links,
                    "tech_stack": tech_stack,
                    "related_projects": related_projects,
                    "local_path": str(item),
                    "has_claude_md": 1 if (item / "CLAUDE.md").exists() else 0,
                    "is_manual": 0,
                }
            continue

        # 基本信息
        log_lines = run_git(item, "log", "--format=%H|%s|%aI", "--no-merges")
        commits = []
        for line in log_lines.splitlines():
            parts = line.split("|", 2)
            if len(parts) == 3:
                commits.append({"hash": parts[0][:7], "subject": parts[1], "date": parts[2]})

        if not commits:
            continue

        # diff stats
        diff_stat = run_git(item, "diff", "--stat", "--shortstat", f"{commits[-1]['hash']}..HEAD")
        files_changed, lines_added, lines_removed = 0, 0, 0
        stat_match = re.search(r"(\d+) files? changed", diff_stat)
        add_match = re.search(r"(\d+) insertions?", diff_stat)
        del_match = re.search(r"(\d+) deletions?", diff_stat)
        if stat_match:
            files_changed = int(stat_match.group(1))
        if add_match:
            lines_added = int(add_match.group(1))
        if del_match:
            lines_removed = int(del_match.group(1))

        # 从 CLAUDE.md / README.md 提取项目名、简介、链接、技术栈和关联项目
        name, description, links, tech_stack, related_projects = extract_project_info(item, slug)

        projects[slug] = {
            "slug": slug,
            "name": name,
            "description": description,
            "status": "active" if (datetime.now() - datetime.fromisoformat(commits[0]["date"].replace("Z", "+00:00")).replace(tzinfo=None)).days < 7 else "paused",
            "total_commits": len(commits),
            "first_commit_at": commits[-1]["date"],
            "last_commit_at": commits[0]["date"],
            "files_changed": files_changed,
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "recent_commits": commits[:20],
            "links": links,
            "tech_stack": tech_stack,
            "related_projects": related_projects,
            "local_path": str(item),
            "has_claude_md": 1 if (item / "CLAUDE.md").exists() else 0,
            "is_manual": 0,
        }
    return projects


def scan_claude_history(projects: dict) -> dict:
    """从 Claude Code 历史中补充会话统计，并发现无 git 的项目"""
    if not CLAUDE_HISTORY.exists():
        return projects

    entries = []
    with open(CLAUDE_HISTORY, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                entries.append(json.loads(line.strip()))
            except Exception:
                pass

    # 按 project 路径分组
    from collections import defaultdict
    by_project = defaultdict(lambda: {"sessions": set(), "messages": 0, "first": None, "last": None})

    quant_str = str(QUANT_ROOT).replace("\\", "/").lower()

    for e in entries:
        proj_path = e.get("project", "").replace("\\", "/")
        display = e.get("display", "")
        session_id = e.get("sessionId", "")
        ts = e.get("timestamp", 0)
        dt = datetime.fromtimestamp(ts / 1000) if ts else None

        # 直接匹配项目路径
        slug = None
        proj_lower = proj_path.lower()
        if quant_str in proj_lower and proj_lower != quant_str:
            # 提取子目录名
            after = proj_path[len(quant_str):].strip("/").split("/")[0] if len(proj_path) > len(quant_str) else ""
            if after:
                slug = after

        # 匹配 Documents 下的非 quant 项目
        if not slug:
            docs_str = "c:/users/汤/documents/"
            if docs_str in proj_lower:
                after = proj_lower[len(docs_str):].split("/")[0]
                if after in [k.lower() for k in EXTRA_PROJECT_PATHS]:
                    # 找回原始大小写
                    for k in EXTRA_PROJECT_PATHS:
                        if k.lower() == after:
                            slug = k
                            break

        # 如果 CWD 是用户根目录，从 display 中查找项目路径引用
        if not slug and display:
            for known_slug in list(projects.keys()) + ["erdos", "favorites-digest", "cashpilot", "nassdaq", "qmt"]:
                patterns = [
                    f"quant/{known_slug}",
                    f"quant\\{known_slug}",
                    known_slug.lower(),
                ]
                for p in patterns:
                    if p in display.lower():
                        slug = known_slug
                        break
                if slug:
                    break

        if slug:
            info = by_project[slug]
            info["sessions"].add(session_id)
            info["messages"] += 1
            if dt:
                if info["first"] is None or dt < info["first"]:
                    info["first"] = dt
                if info["last"] is None or dt > info["last"]:
                    info["last"] = dt

    # 合并到 projects
    for slug, info in by_project.items():
        if slug in projects:
            projects[slug]["claude_sessions"] = len(info["sessions"])
            projects[slug]["claude_messages"] = info["messages"]
        else:
            # 无 git 的项目，仅从 Claude 历史中发现
            pi = PROJECT_INFO.get(slug, {})
            local_path = str(QUANT_ROOT / slug)
            projects[slug] = {
                "slug": slug,
                "name": pi.get("name", slug),
                "description": pi.get("description", f"{slug} 项目"),
                "status": "active" if info["last"] and (datetime.now() - info["last"]).days < 7 else "paused",
                "total_commits": 0,
                "first_commit_at": info["first"].isoformat() if info["first"] else None,
                "last_commit_at": info["last"].isoformat() if info["last"] else None,
                "files_changed": 0,
                "lines_added": 0,
                "lines_removed": 0,
                "claude_sessions": len(info["sessions"]),
                "claude_messages": info["messages"],
                "recent_commits": [],
                "links": pi.get("links", {}),
                "tech_stack": pi.get("tech_stack", []),
                "related_projects": pi.get("related_projects", []),
                "local_path": local_path,
                "has_claude_md": 1 if (QUANT_ROOT / slug / "CLAUDE.md").exists() else 0,
                "is_manual": 0,
            }

    return projects


def scan_claude_sessions(projects: dict) -> dict:
    """从 Claude Code 历史中找到每个项目最近的 sessionId，生成 resume 命令"""
    if not CLAUDE_HISTORY.exists():
        return projects

    entries = []
    with open(CLAUDE_HISTORY, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                entries.append(json.loads(line.strip()))
            except Exception:
                pass

    quant_str = str(QUANT_ROOT).replace("\\", "/").lower()

    # 找每个项目最近的 session
    latest_session = {}  # slug -> (timestamp, session_id)

    for e in entries:
        proj_path = e.get("project", "").replace("\\", "/")
        display = e.get("display", "")
        session_id = e.get("sessionId", "")
        ts = e.get("timestamp", 0)

        slug = None
        proj_lower = proj_path.lower()
        if quant_str in proj_lower and proj_lower != quant_str:
            after = proj_path[len(quant_str):].strip("/").split("/")[0] if len(proj_path) > len(quant_str) else ""
            if after and after.lower() != "devlog":
                slug = after

        if not slug and display:
            for known_slug in projects.keys():
                patterns = [
                    f"quant/{known_slug}",
                    f"quant\\{known_slug}",
                    known_slug.lower(),
                ]
                for p in patterns:
                    if p in display.lower():
                        slug = known_slug
                        break
                if slug:
                    break

        if slug and slug in projects and session_id and ts:
            prev = latest_session.get(slug)
            if prev is None or ts > prev[0]:
                latest_session[slug] = (ts, session_id)

    for slug, (_, session_id) in latest_session.items():
        projects[slug]["claude_resume_cmd"] = f"claude --resume {session_id}"

    return projects


def push_to_d1(projects: dict):
    """通过 wrangler d1 execute 推送数据，保留手动项目和备注"""
    # 用 DELETE + INSERT，但保留 notes：先删除非手动项目，再插入
    # notes 通过 COALESCE 子查询保留
    statements = ["DELETE FROM projects WHERE is_manual = 0;"]

    for p in projects.values():
        recent = json.dumps(p.get("recent_commits", []), ensure_ascii=False)
        links = json.dumps(p.get("links", {}), ensure_ascii=False)
        tech_stack = json.dumps(p.get("tech_stack", []), ensure_ascii=False)
        related_projects = json.dumps(p.get("related_projects", []), ensure_ascii=False)
        # 转义单引号
        name = p["name"].replace("'", "''")
        desc = p["description"].replace("'", "''")
        recent_escaped = recent.replace("'", "''")
        links_escaped = links.replace("'", "''")
        tech_escaped = tech_stack.replace("'", "''")
        related_escaped = related_projects.replace("'", "''")
        local_path = p.get("local_path", "").replace("\\", "/").replace("'", "''")
        claude_resume = p.get("claude_resume_cmd", "").replace("'", "''")

        sql = (
            f"INSERT INTO projects (slug, name, description, status, total_commits, "
            f"first_commit_at, last_commit_at, files_changed, lines_added, lines_removed, "
            f"claude_sessions, claude_messages, recent_commits, links, "
            f"tech_stack, related_projects, local_path, has_claude_md, is_manual, claude_resume_cmd, "
            f"scanned_at) VALUES ("
            f"'{p['slug']}', '{name}', '{desc}', '{p['status']}', {p['total_commits']}, "
            f"'{p.get('first_commit_at', '')}', '{p.get('last_commit_at', '')}', "
            f"{p['files_changed']}, {p['lines_added']}, {p['lines_removed']}, "
            f"{p.get('claude_sessions', 0)}, {p.get('claude_messages', 0)}, "
            f"'{recent_escaped}', '{links_escaped}', "
            f"'{tech_escaped}', '{related_escaped}', '{local_path}', "
            f"{p.get('has_claude_md', 0)}, 0, '{claude_resume}', "
            f"datetime('now'));"
        )
        statements.append(sql)

    sql_file = DEVLOG_ROOT / "scanner" / "_push.sql"
    sql_file.write_text("\n".join(statements), encoding="utf-8")

    print(f"推送 {len(projects)} 个项目到 D1...")
    result = subprocess.run(
        f'npx wrangler d1 execute {D1_DB} --remote --file="{sql_file}"',
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=str(DEVLOG_ROOT), timeout=60, shell=True
    )
    if result.returncode == 0:
        print("推送成功！")
    else:
        # wrangler stderr may contain unicode chars that GBK can't encode
        stderr = result.stderr.encode('ascii', errors='replace').decode('ascii')
        print(f"推送失败: {stderr}")
        # Check if it's just a warning (wrangler sometimes returns non-zero for warnings)
        if "Success" in result.stdout or "Executed" in result.stdout:
            print("(但 stdout 表示成功)")
        else:
            sys.exit(1)

    sql_file.unlink(missing_ok=True)


def main():
    print("=== Devlog Scanner ===")
    print(f"扫描目录: {QUANT_ROOT}")
    print(f"Claude 历史: {CLAUDE_HISTORY}")
    print()

    print("[1/4] 扫描 Git 项目...")
    projects = scan_git_projects()
    print(f"  发现 {len(projects)} 个 Git 项目")

    print("[2/4] 解析 Claude Code 历史...")
    projects = scan_claude_history(projects)
    print(f"  共 {len(projects)} 个项目（含无 git 项目）")

    print("[3/4] 扫描 Claude 会话 resume 信息...")
    projects = scan_claude_sessions(projects)
    resume_count = sum(1 for p in projects.values() if p.get("claude_resume_cmd"))
    print(f"  {resume_count} 个项目有可恢复会话")

    print("[4/4] 推送到 D1...")
    push_to_d1(projects)

    print()
    print("项目概览:")
    for p in sorted(projects.values(), key=lambda x: x.get("last_commit_at") or "", reverse=True):
        commits = p["total_commits"]
        sessions = p.get("claude_sessions", 0)
        print(f"  [{p['status']:>7}] {p['slug']:<25} {commits:>3} commits, {sessions:>2} sessions")


if __name__ == "__main__":
    main()
