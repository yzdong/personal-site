import Link from "next/link";
import { getAllPosts } from "@/lib/posts";

export default async function Home() {
  const posts = await getAllPosts();
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Zi Dong</h1>
      </header>

      <section>
        <h2 className="mb-3 font-semibold">Musings</h2>
        <ul className="space-y-1">
          {posts.map((post) => (
            <li key={post.slug}>
              <span className="tabular-nums text-[color:var(--muted)]">
                {post.date}
              </span>{" "}
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">About</h2>
        <p>
          Hi, I&apos;m Zi. I&apos;ve been building software primarily for
          enterprise (government, IoT, data platforms) for the past 10+ years.
          Most recently I am the founder of{" "}
          <a href="https://getnen.ai">Nen</a>, a developer platform for
          computer use. I&apos;m interested in building tools for developers
          in enterprises, software that works for teams with mixed technical
          abilities, and generally building useful things that reduce human
          toil. I&apos;m also an avid climber of all disciplines.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Get in touch</h2>
        <p>
          <a href="mailto:yangzi@yzdong.me">Email</a> ·{" "}
          <a href="https://github.com/yzdong">GitHub</a> ·{" "}
          <a href="https://www.linkedin.com/in/yzdong/">LinkedIn</a> ·{" "}
          <a href="https://x.com/dongyangzi">X</a>
        </p>
      </section>
    </div>
  );
}
