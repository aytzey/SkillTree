# Legacy Web Prototype

This folder contains the original Next.js implementation kept for migration history only.

The active product is the Rust desktop app in `crates/skilltree-local` plus the optional Obsidian plugin in `obsidian-plugin/skilltree-control`.

The root `package.json` intentionally does not install Next.js, Prisma, Jest, or Tailwind dependencies. That keeps the release project focused on the desktop app, keeps `npm audit` clean, and avoids presenting the archived web prototype as the current deployment path.
