import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getListedPosts } from './postsRegistry.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import './blog.css';

export default function BlogList() {
  useDocumentTitle('Soklynin Nou | Blog');
  const [query, setQuery] = useState('');
  const posts = getListedPosts();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q),
    );
  }, [query, posts]);

  return (
    <div className="container blog-container">
      <div className="blog-header">
        <h1 className="blog-heading">Recent Posts</h1>
        <span className="post-count">({filtered.length})</span>
      </div>
      <p className="blog-description">
        Here you&apos;ll find all sorts of things, from random ramblings to structured opinion pieces
        (although it&apos;s probably mostly ramblings).
      </p>
      <input
        type="text"
        className="blog-search"
        placeholder="Search posts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="posts-list">
        {filtered.length === 0 ? (
          <p className="empty-state">No posts match that search.</p>
        ) : (
          filtered.map((post) => <PostCard key={post.slug} post={post} />)
        )}
      </div>
    </div>
  );
}

function PostCard({ post }) {
  return (
    <Link className="post-card" to={`/blog/${post.slug}`}>
      <div className="post-content">
        <div className="post-category">{post.category}</div>
        <div className="post-status">
          <span style={{ color: 'blue' }}>Status: </span>
          {post.status}
        </div>
        <h2 className="post-title">{post.title}</h2>
        <p className="post-date">{post.date}</p>
        {post.lastUpdated && post.lastUpdated !== post.date && (
          <p className="post-last-updated">Last updated: {post.lastUpdated}</p>
        )}
        <p className="post-excerpt">{post.excerpt}</p>
        <span className="read-more">
          Read More <span className="arrow">↗</span>
        </span>
      </div>
      {post.image && <img src={post.image} className="post-image" alt="" />}
    </Link>
  );
}
