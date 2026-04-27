# Drafts

Anything in this directory is **not built and not routed**. The blog
loader (`src/lib/posts.ts`) and the slug route
(`src/app/blog/[slug]/page.tsx`) both only read from
`src/content/blog/`, so files here:

- don't appear on the homepage list
- don't get a static route generated (404 if visited directly)
- still build cleanly because nothing imports them

## Workflow

- **New idea, not ready to ship:** create the .mdx here.
- **Promote to published:** move the file to `src/content/blog/`. No
  other change required — frontmatter and imports are identical.
- **Demote a published post:** move it back here.

The directory is the source of truth — there is no `draft: true`
frontmatter to keep in sync.
