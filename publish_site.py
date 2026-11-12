"""Publish the curated build in site/ as one new commit on the gh-pages branch.

Regime: single script of the pipeline, standard library only.

Data flow: site/ -> checks for internal material -> a temporary git index whose work tree is
site/ -> a tree object plus .nojekyll -> a commit whose parent is origin/gh-pages -> a
fast-forward push of that commit to refs/heads/gh-pages.

Usage:
    python publish_site.py            check, commit and push
    python publish_site.py --dry-run  check and build the commit, push nothing

Design decisions, after the Research Coordination's commission of 2026-11-12:
- The working tree never switches branch and no second checkout is made; the commit is built
  with plumbing (GIT_INDEX_FILE, write-tree, commit-tree), so parallel sessions in this
  working tree are unaffected.
- Every build is a further commit on gh-pages. The push is a plain fast-forward; a rejected
  push means the remote moved and is reported, never forced.
- The build bookkeeping file .edition-build stays out of the published tree.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE / "site"
BRANCH = "gh-pages"
# Path parts that only internal material carries; any of them in the build aborts publication.
INTERNAL_PARTS = {"knowledge", "runs", "review", "checks", "handoff", "journal", ".git", "__pycache__"}
INTERNAL_SUFFIXES = {".md", ".py", ".pyc", ".jsonl"}
# Links into internal material inside served pages.
# The local review build marks its pages; such a build is never published.
REVIEW_MARK = 'name="edition-review"'
INTERNAL_LINK = re.compile(r"""(?:href|src)=["'][^"']*(?:knowledge/|runs/|review/)""")
EXCLUDE = {".edition-build"}


class PublishError(Exception):
    """A failed precondition; the message names the step."""


def _git(*args: str, env: dict[str, str] | None = None, stdin: str | None = None) -> str:
    result = subprocess.run(
        ["git", *args], cwd=HERE, capture_output=True, text=True, encoding="utf-8", env=env, input=stdin
    )
    if result.returncode != 0:
        raise PublishError(f"git {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout.strip()


def _check_site() -> list[Path]:
    """Every file to publish, after the internal-material check."""
    if not (SITE / "index.html").is_file():
        raise PublishError(f"no build in {SITE}; run build_site.py first")
    files = sorted(p for p in SITE.rglob("*") if p.is_file() and p.name not in EXCLUDE)
    problems: list[str] = []
    for path in files:
        rel = path.relative_to(SITE)
        if INTERNAL_PARTS & {part.lower() for part in rel.parts} or path.suffix.lower() in INTERNAL_SUFFIXES:
            problems.append(f"internal file: {rel.as_posix()}")
        elif path.suffix == ".html" and INTERNAL_LINK.search(path.read_text(encoding="utf-8")):
            problems.append(f"link into internal material: {rel.as_posix()}")
        elif path.suffix == ".html" and REVIEW_MARK in path.read_text(encoding="utf-8"):
            problems.append(f"page of the review build: {rel.as_posix()}")
        elif rel.parts and rel.parts[0] == "pruefung":
            problems.append(f"review material: {rel.as_posix()}")
    if problems:
        raise PublishError("build carries internal material:\n" + "\n".join(problems))
    return files


def _build_commit(files: list[Path], parent: str, message: str) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        env = {**os.environ, "GIT_INDEX_FILE": str(Path(tmp) / "index"), "GIT_WORK_TREE": str(SITE)}
        paths = "\n".join(p.relative_to(SITE).as_posix() for p in files)
        # --force: the repository's .gitignore names site/, which must not filter the build.
        _git("add", "--force", "--pathspec-from-file=-", env=env, stdin=paths)
        empty = _git("hash-object", "-w", "--stdin", stdin="")
        _git("update-index", "--add", "--cacheinfo", f"100644,{empty},.nojekyll", env=env)
        tree = _git("write-tree", env=env)
    if tree == _git("rev-parse", f"{parent}^{{tree}}"):
        raise PublishError("the build is identical with the published state; nothing to publish")
    return _git("commit-tree", tree, "-p", parent, "-m", message)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--dry-run", action="store_true", help="build the commit but push nothing")
    args = parser.parse_args()
    try:
        files = _check_site()
        _git("fetch", "--quiet", "origin", BRANCH)
        parent = _git("rev-parse", f"origin/{BRANCH}")
        source = _git("rev-parse", "--short", "HEAD")
        dirty = " with uncommitted changes" if _git("status", "--porcelain", "--untracked-files=no") else ""
        message = f"Publish the curated edition build (source {source}{dirty})"
        commit = _build_commit(files, parent, message)
        print(f"checked {len(files)} files; commit {commit[:7]} on {parent[:7]}")
        if args.dry_run:
            print("dry run, nothing pushed")
            return 0
        _git("push", "origin", f"{commit}:refs/heads/{BRANCH}")
        print(f"pushed {commit[:7]} to {BRANCH}")
    except PublishError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
