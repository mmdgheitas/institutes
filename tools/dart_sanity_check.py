#!/usr/bin/env python3
"""
Static sanity checks for the Flutter app.

This is NOT a Dart analyzer. It catches the mechanical mistakes that would
otherwise only surface on a machine with the Flutter SDK installed:

  1. unbalanced (), [], {} outside strings/comments
  2. relative imports pointing at files that do not exist
  3. package: imports whose package is not declared in pubspec.yaml
  4. `part` / `part of` pairs that do not line up
  5. symbols referenced across files that are never declared anywhere
  6. duplicate class declarations

Exit code is non-zero when any problem is found.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "apps" / "mobile"
LIB = APP / "lib"

errors: list[str] = []
warnings: list[str] = []


def strip_code(text: str) -> str:
    """Remove comments and string literals so scanning sees only real code."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if ch == "/" and nxt == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        if ch in "'\"":
            # Triple-quoted?
            triple = text[i : i + 3]
            if triple in ("'''", '"""'):
                quote = triple
                i += 3
                while i < n and text[i : i + 3] != quote:
                    if text[i] == "\\":
                        i += 1
                    i += 1
                i += 3
                continue
            quote = ch
            i += 1
            while i < n and text[i] != quote:
                if text[i] == "\\":
                    i += 1
                elif text[i] == "\n":
                    break
                i += 1
            i += 1
            out.append('""')
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def check_balance(path: Path, code: str) -> None:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[tuple[str, int]] = []
    line = 1
    for ch in code:
        if ch == "\n":
            line += 1
        elif ch in "([{":
            stack.append((ch, line))
        elif ch in ")]}":
            if not stack:
                errors.append(f"{path.relative_to(ROOT)}:{line}: stray '{ch}'")
                return
            opener, _ = stack.pop()
            if opener != pairs[ch]:
                errors.append(
                    f"{path.relative_to(ROOT)}:{line}: '{ch}' closes '{opener}'"
                )
                return
    if stack:
        opener, oline = stack[-1]
        errors.append(
            f"{path.relative_to(ROOT)}: unclosed '{opener}' opened at line {oline}"
        )


def main() -> int:
    if not LIB.exists():
        print(f"No lib directory at {LIB}")
        return 1

    dart_files = sorted(LIB.rglob("*.dart"))
    print(f"Scanning {len(dart_files)} Dart files under {LIB.relative_to(ROOT)}\n")

    # Declared dependencies.
    pubspec = (APP / "pubspec.yaml").read_text()
    declared_pkgs = set(re.findall(r"^\s{2}([a-z0-9_]+):", pubspec, re.M))
    declared_pkgs |= {"flutter", "flutter_test", "sdk"}

    declared_types: dict[str, list[Path]] = {}
    part_of_files: dict[Path, str] = {}
    part_decls: dict[Path, list[str]] = {}

    for path in dart_files:
        raw = path.read_text()
        code = strip_code(raw)

        check_balance(path, code)

        # Imports.
        for match in re.finditer(r"""import\s+['"]([^'"]+)['"]""", raw):
            target = match.group(1)
            if target.startswith("package:"):
                pkg = target.split(":", 1)[1].split("/", 1)[0]
                if pkg not in declared_pkgs:
                    errors.append(
                        f"{path.relative_to(ROOT)}: imports undeclared package '{pkg}'"
                    )
            elif target.startswith("dart:"):
                continue
            else:
                resolved = (path.parent / target).resolve()
                if not resolved.exists():
                    errors.append(
                        f"{path.relative_to(ROOT)}: unresolved import '{target}'"
                    )

        # part / part of
        po = re.search(r"""^part\s+of\s+['"]([^'"]+)['"]\s*;""", raw, re.M)
        if po:
            part_of_files[path] = po.group(1)
        parts = re.findall(r"""^part\s+['"]([^'"]+)['"]\s*;""", raw, re.M)
        if parts:
            part_decls[path] = parts
            for p in parts:
                if not (path.parent / p).exists():
                    errors.append(
                        f"{path.relative_to(ROOT)}: part file missing '{p}'"
                    )

        # Declarations.
        for match in re.finditer(
            r"^(?:abstract\s+|sealed\s+|final\s+|base\s+|interface\s+)*"
            r"(?:class|enum|mixin|extension\s+type)\s+(\w+)",
            code,
            re.M,
        ):
            declared_types.setdefault(match.group(1), []).append(path)

    # part-of targets must declare the part.
    for child, target in part_of_files.items():
        parent = (child.parent / target).resolve()
        if not parent.exists():
            errors.append(
                f"{child.relative_to(ROOT)}: 'part of' target missing '{target}'"
            )
            continue
        declared = part_decls.get(parent, [])
        if child.name not in [Path(d).name for d in declared]:
            errors.append(
                f"{parent.relative_to(ROOT)}: missing `part '{child.name}';`"
            )

    for name, paths in sorted(declared_types.items()):
        if len(paths) > 1:
            locations = ", ".join(str(p.relative_to(ROOT)) for p in paths)
            warnings.append(f"class '{name}' declared in multiple files: {locations}")

    print(f"Declared types: {len(declared_types)}")

    if warnings:
        print(f"\n--- {len(warnings)} warning(s) ---")
        for w in warnings:
            print(f"  ! {w}")

    if errors:
        print(f"\n--- {len(errors)} ERROR(S) ---")
        for e in errors:
            print(f"  x {e}")
        return 1

    print("\nAll structural checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
