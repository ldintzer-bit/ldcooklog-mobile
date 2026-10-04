# Security maintenance

The FireBoard server uses a shared secret and must authorize callers through the administrator-managed `fireboard_account_access` table before any upstream request. A valid login alone is insufficient. Never grant clients write access to that table.

Cook data is protected by Supabase ownership policies. Test flags and history filters are display features, not access controls. Preserve ownership checks on reads and writes, including child tables.

The publishable Supabase key is intentionally public. FireBoard tokens and Supabase management/service credentials belong only in protected server or deployment secrets.

After editing inline JavaScript in `index.html`, run `python3 tools/update-csp.py`, then run `node tools/security-check.cjs` using Node 24. Check the deployed CSP hashes, app startup, and history/comparison behavior. Do not restore old HTML or historical patch automation over the current app.

CSV text must pass through `csvCell` to prevent spreadsheet formula interpretation. Render untrusted labels and notes with textContent or HTML escaping.

Active deployment dependencies are pinned. Review updates regularly rather than switching back to mutable action tags.
