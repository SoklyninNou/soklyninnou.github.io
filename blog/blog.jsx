// Blog landing page — React component rendered via in-browser Babel transpilation.
// To add a post: append an entry to the `posts` array below and create a matching
// HTML file in blog/ (use blog/about-me.html as a template — it sets <base href="/">
// and overrides goto() so the shared header still navigates correctly from the subfolder).

const { useMemo, useState } = React;

const posts = [
    {
        id: 'about-me',
        category: 'Personal',
        status: 'Complete',
        title: 'About Me',
        date: 'April 23, 2026',
        excerpt: "Hi! Welcome to my blog. I figured it would make sense to introduce myself in a first post, so that's what we're doing.",
        image: 'pictures/me-irl.jpg',
        url: 'blog/about-me.html',
    },
    {
        id: 'learning-claude',
        category: 'Journal',
        status: 'Ongoing',
        title: 'Learning Claude',
        date: 'April 23, 2026',
        excerpt: "I am currently learning how to work with Claude and making things like skills and agents and thought I should document my progress. This is a journal of my learning process.",
        image: 'pictures/claude.png',
        url: 'blog/learning-claude.html',
    }
];


function BlogLanding() {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return posts;
        return posts.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.excerpt.toLowerCase().includes(q) ||
            p.status.toLowerCase().includes(q)
        );
    }, [query]);

    return (
        <div className="container blog-container">
            <div className="blog-header">
                <h1 className="blog-heading">Recent Posts</h1>
                <span className="post-count">({filtered.length})</span>
            </div>
            <p className="blog-description">
                Here you'll find all sorts of things, from random ramblings to structured opinion pieces (although it's probably mostly ramblings).
            </p>
            <input
                type="text"
                className="blog-search"
                placeholder="Search posts…"
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            <div className="posts-list">
                {filtered.length === 0
                    ? <p className="empty-state">No posts match that search.</p>
                    : filtered.map(post => <PostCard key={post.id} post={post} />)}
            </div>
        </div>
    );
}

function PostCard({ post }) {
    return (
        <a className="post-card" href={post.url}>
            <div className="post-content">
                <div className="post-category">{post.category}</div>
                <div className="post-status"><a style={{ color: 'blue'}}>Status: </a>{post.status}</div>
                <h2 className="post-title">{post.title}</h2>
                <p className="post-date">{post.date}</p>
                <p className="post-excerpt">{post.excerpt}</p>
                <span className="read-more">Read More <span className="arrow">↗</span></span>
            </div>
            {post.image && (
                <img src={post.image} className="post-image" alt="" />
            )}
        </a>
    );
}

const root = ReactDOM.createRoot(document.getElementById('blog-root'));
root.render(<BlogLanding />);
