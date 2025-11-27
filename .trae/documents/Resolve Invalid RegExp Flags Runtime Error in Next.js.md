## Diagnosis
- The server crashes in Next’s vendor chunk with “Invalid regular expression flags” during SSR. This is commonly caused by building with a Node version that doesn’t support modern RegExp flags used by Next 15 (e.g., `d` or `v`).
- We already removed decorators and fixed project-side RegExp usages; repository search shows only literal `'gi'` flags. The error originates in Next’s compiled vendor code, not your source.

## Plan
1) Verify environment
- Check Node version; ensure Node ≥ 20 (Next 15 targets modern Node features). If Node < 20, upgrade to Node 20 LTS.

2) Clean and reinstall
- Stop dev servers; delete `.next` and `node_modules`.
- Reinstall with `npm ci` to ensure consistent dependency versions aligned with Next 15.

3) Rebuild without Turbopack
- Run `npm run dev` (Webpack dev). Confirm SSR no longer throws the RegExp flags error and the app renders.

4) If still failing
- Pin React to the supported pairing (React 18.x) and rebuild to rule out overlay/tooling mismatches with React 19.
- Alternatively pin Next to `15.1.x` temporarily if a vendor chunk regression persists.

5) Verification
- Load `/` and confirm UI renders (no 500). Validate portfolio token list and pricing flows. Confirm no 429 bursts thanks to batching.

On approval, I’ll perform the environment check, upgrade Node if needed, clean the build, reinstall, and restart dev to clear the white screen.