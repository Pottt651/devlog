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


def scan_git_projects() -> dict:
    """扫描 quant/ 下所有 git 项目"""
    projects = {}
    for item in sorted(QUANT_ROOT.iterdir()):
        if not item.is_dir() or not (item / ".git").exists():
            continue
        slug = item.name
        if slug == "devlog":
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

        # 项目名：尝试从 README 或 CLAUDE.md 提取
        name = slug
        for readme in ["README.md", "CLAUDE.md"]:
            readme_path = item / readme
            if readme_path.exists():
                try:
                    first_line = readme_path.read_text(encoding="utf-8", errors="replace").split("\n")[0]
                    if first_line.startswith("#"):
                        name = first_line.lstrip("#").strip()
                        break
                except Exception:
                    pass

        # 描述：从最近的 commit subjects 生成
        recent_subjects = [c["subject"] for c in commits[:10]]
        description = "; ".join(recent_subjects)

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
            if after and after.lower() != "devlog":
                slug = after

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
            projects[slug] = {
                "slug": slug,
                "name": slug,
                "description": f"Claude Code 会话项目 ({info['messages']} 条消息)",
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
            }

    return projects


def push_to_d1(projects: dict):
    """通过 wrangler d1 execute 推送数据"""
    statements = ["DELETE FROM projects;"]

    for p in projects.values():
        recent = json.dumps(p.get("recent_commits", []), ensure_ascii=False)
        # 转义单引号
        name = p["name"].replace("'", "''")
        desc = p["description"].replace("'", "''")
        recent_escaped = recent.replace("'", "''")

        sql = (
            f"INSERT INTO projects (slug, name, description, status, total_commits, "
            f"first_commit_at, last_commit_at, files_changed, lines_added, lines_removed, "
            f"claude_sessions, claude_messages, recent_commits, scanned_at) VALUES ("
            f"'{p['slug']}', '{name}', '{desc}', '{p['status']}', {p['total_commits']}, "
            f"'{p.get('first_commit_at', '')}', '{p.get('last_commit_at', '')}', "
            f"{p['files_changed']}, {p['lines_added']}, {p['lines_removed']}, "
            f"{p.get('claude_sessions', 0)}, {p.get('claude_messages', 0)}, "
            f"'{recent_escaped}', datetime('now'));"
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
        print(f"推送失败: {result.stderr}")
        sys.exit(1)

    sql_file.unlink(missing_ok=True)


def main():
    print("=== Devlog Scanner ===")
    print(f"扫描目录: {QUANT_ROOT}")
    print(f"Claude 历史: {CLAUDE_HISTORY}")
    print()

    print("[1/3] 扫描 Git 项目...")
    projects = scan_git_projects()
    print(f"  发现 {len(projects)} 个 Git 项目")

    print("[2/3] 解析 Claude Code 历史...")
    projects = scan_claude_history(projects)
    print(f"  共 {len(projects)} 个项目（含无 git 项目）")

    print("[3/3] 推送到 D1...")
    push_to_d1(projects)

    print()
    print("项目概览:")
    for p in sorted(projects.values(), key=lambda x: x.get("last_commit_at") or "", reverse=True):
        commits = p["total_commits"]
        sessions = p.get("claude_sessions", 0)
        print(f"  [{p['status']:>7}] {p['slug']:<25} {commits:>3} commits, {sessions:>2} sessions")


if __name__ == "__main__":
    main()
