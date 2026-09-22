# Elev8 Services app export

Contents:
- `src/` — all application code (pages, ATS workspace, server functions, shared libraries, UI components)
- `public/` — favicon and robots.txt
- `src/assets/*.asset.json` — image pointer files used by the app
- `assets-originals/` — the actual image files those pointers reference
- `supabase/migrations/` — every database migration, in order (23 files)
- `supabase/config.toml`, `package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`, `eslint.config.js`, `bunfig.toml` — configuration

Not included: installed packages (`node_modules`), build output, version-control data, and the environment file holding project keys.
