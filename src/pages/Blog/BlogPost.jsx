import { useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPostBySlug } from './postsRegistry.js';
import TableOfContents from './TableOfContents.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import './blog.css';

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);
  const layoutRef = useRef(null);
  const contentRef = useRef(null);

  useDocumentTitle(post ? `${post.title} | Soklynin Nou` : 'Soklynin Nou | Blog');

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const { Content } = post;

  return (
    <div className="blog-layout" ref={layoutRef}>
      <div className="container blog-container">
        <article className="post-page">
          <div className="post-category">{post.category}</div>
          <h1 className="post-page-title">{post.title}</h1>
          <p className="post-page-date">{post.date}</p>
          <div className="post-body" ref={contentRef}>
            <Content />
          </div>
          <Link className="back-link" to="/blog">
            ← Back to all posts
          </Link>
        </article>
      </div>
      <TableOfContents layoutRef={layoutRef} contentRef={contentRef} contentKey={post.slug} />
    </div>
  );
}
