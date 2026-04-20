import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostSlugs } from "@/lib/posts";
import type { PostMetadata } from "@/lib/posts";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

async function loadPost(slug: string) {
  try {
    return await import(`@/content/blog/${slug}.mdx`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = await loadPost(slug);
  if (!mod) return {};
  const meta = mod.metadata as PostMetadata;
  return { title: meta.title, description: meta.description };
}

export default async function Post({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = await loadPost(slug);
  if (!mod) notFound();
  const { default: Content, metadata } = mod as {
    default: React.ComponentType;
    metadata: PostMetadata;
  };
  return (
    <article>
      <p className="mb-8 text-sm">
        <Link href="/">← home</Link>
      </p>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{metadata.title}</h1>
        <time className="text-sm tabular-nums text-[color:var(--muted)]">
          {metadata.date}
        </time>
      </header>
      <div className="prose prose-neutral max-w-none">
        <Content />
      </div>
    </article>
  );
}
