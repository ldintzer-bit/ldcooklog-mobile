#!/usr/bin/env python3
"""Local-only pg_dump custom archive -> verifiable relational JSON for LDCookLog.

Does not connect to Supabase or send data over a network. Requires pg_restore.
Keep the original .dump: JSON is an additional migration artifact, not a substitute.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

FORMAT = 'ldcooklog-supabase-relational-export'
VERSION = 1
EXPECTED = frozenset('''cooks events cook_equipment cook_evaluations cook_fireboard_sessions
cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment
fireboard_account_access fireboard_probe_roles fireboard_temperature_samples
locations rubs sauces weather'''.split())
COPY_HEADER = re.compile(r'^COPY public\.([a-z_][a-z_0-9]*) \(([a-z_0-9, ]+)\) FROM stdin;$')
ESCAPES = {'t': '\t', 'n': '\n', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '\\': '\\'}


def decode_copy_field(field):
    """Decode text-format PostgreSQL COPY, not CSV, including literal \\N nulls."""
    if field == r'\N':
        return None
    output = []
    i = 0
    while i < len(field):
        ch = field[i]
        if ch != '\\':
            output.append(ch)
            i += 1
            continue
        if i + 1 >= len(field):
            raise ValueError('Truncated COPY escape')
        nxt = field[i + 1]
        if nxt in ESCAPES:
            output.append(ESCAPES[nxt])
            i += 2
        elif nxt == 'x':
            match = re.match(r'[0-9a-fA-F]{1,2}', field[i + 2:])
            if not match:
                raise ValueError('Invalid hex COPY escape')
            output.append(chr(int(match.group(), 16)))
            i += 2 + len(match.group())
        elif nxt in '01234567':
            match = re.match(r'[0-7]{1,3}', field[i + 1:])
            output.append(chr(int(match.group(), 8)))
            i += 1 + len(match.group())
        else:
            # PostgreSQL treats a non-special escaped character as itself.
            output.append(nxt)
            i += 2
    return ''.join(output)


def parse_copy(lines):
    tables = {}
    current = None
    cols = None
    for line_number, line in enumerate(lines, 1):
        line = line.rstrip('\n')
        if line.endswith('\r'):
            line = line[:-1]
        if current is not None:
            if line == r'\.':
                current, cols = None, None
                continue
            parts = line.split('\t')
            if len(parts) != len(cols):
                raise ValueError(f'COPY line {line_number}: expected {len(cols)} columns, got {len(parts)}')
            tables[current]['rows'].append(dict(zip(cols, map(decode_copy_field, parts))))
        elif line.startswith('COPY '):
            match = COPY_HEADER.fullmatch(line)
            if not match:
                raise ValueError(f'Unsupported COPY declaration at line {line_number}: {line[:120]}')
            table, column_text = match.groups()
            if table in tables:
                raise ValueError(f'Repeated COPY block for {table}')
            cols = column_text.split(', ')
            if len(cols) != len(set(cols)):
                raise ValueError(f'Duplicate column in {table}')
            tables[table] = {'columns': cols, 'rows': []}
            current = table
    if current is not None:
        raise ValueError(f'Truncated COPY block for {current}')
    return tables


def make_archive(tables, created_at):
    body = {
        'format': FORMAT,
        'version': VERSION,
        'createdAt': created_at,
        'tables': {k: tables[k] for k in sorted(tables)},
    }
    canonical = json.dumps(body, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return {**body, 'sha256': hashlib.sha256(canonical).hexdigest()}


def restore_binary():
    paths = ['/opt/homebrew/opt/libpq/bin/pg_restore', '/usr/local/opt/libpq/bin/pg_restore']
    found = next((p for p in paths if Path(p).is_file()), None) or shutil.which('pg_restore')
    if not found:
        raise RuntimeError('pg_restore not found. Install PostgreSQL libpq before continuing.')
    return found


def convert_file(dump_path, target_path, expected_cooks=None):
    if not dump_path.is_file():
        raise FileNotFoundError(f'Archive not found: {dump_path}')
    command = [restore_binary(), '--data-only', '--schema=public', '--file=-', str(dump_path)]
    # Capture full diagnostic error text, never a password or data in command args.
    result = subprocess.run(command, check=False, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(f'pg_restore failed (exit {result.returncode}): {result.stderr[-1200:]}')
    tables = parse_copy(result.stdout.splitlines(keepends=True))
    missing = EXPECTED - tables.keys()
    if missing:
        raise ValueError('Missing expected tables: ' + ', '.join(sorted(missing)))
    count = len(tables['cooks']['rows'])
    if expected_cooks is not None and count != expected_cooks:
        raise ValueError(f'Expected {expected_cooks} cooks, found {count}; no output created')
    created_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    archive = make_archive(tables, created_at)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, tmp_name = tempfile.mkstemp(prefix='.ldcooklog-', suffix='.tmp', dir=target_path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as f:
            json.dump(archive, f, ensure_ascii=False, indent=None, separators=(',', ':'))
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, target_path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)
    return {k: len(v['rows']) for k, v in tables.items()}


def main():
    parser = argparse.ArgumentParser(description='Extract private LDCookLog data from an existing PostgreSQL .dump. Does not connect to the Internet.')
    parser.add_argument('dump', type=Path, help='Path to LDCookLog PostgreSQL .dump')
    parser.add_argument('--output', type=Path, help='Where to write private relational JSON (default: beside dump)')
    parser.add_argument('--expected-cooks', type=int, default=None, help='Require this exact cook count')
    args = parser.parse_args()
    if args.expected_cooks is not None and args.expected_cooks < 0:
        parser.error('--expected-cooks must be nonnegative')
    output = args.output or args.dump.with_suffix('.relational.json')
    if output.resolve() == args.dump.resolve():
        parser.error('Refusing to overwrite the original dump')
    try:
        counts = convert_file(args.dump, output, args.expected_cooks)
    except (RuntimeError, FileNotFoundError, ValueError, OSError, UnicodeError) as exc:
        print('CONVERSION FAILED:', exc, file=sys.stderr)
        return 1
    print('LOCAL EXPORT CREATED:', output)
    for name, count in sorted(counts.items()):
        print(f'  {name}: {count}')
    print('KEEP THE ORIGINAL .dump FILE. Neither file has been uploaded anywhere by this script.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
