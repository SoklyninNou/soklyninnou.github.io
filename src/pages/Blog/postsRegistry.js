import AboutMeContent from './posts/AboutMeContent.jsx';
import RandomRamblingsContent from './posts/RandomRamblingsContent.jsx';
import LearningClaudeContent from './posts/LearningClaudeContent.jsx';

// `listed: false` keeps a post reachable at /blog/<slug> without showing it on
// the blog landing page (used previously by commenting the entry out in blog.jsx).
export const posts = [
  {
    slug: 'about-me',
    category: 'Personal',
    status: 'Complete',
    title: 'About Me',
    date: 'April 23, 2026',
    excerpt:
      "Hi! Welcome to my blog. I figured it would make sense to introduce myself in a first post, so that's what we're doing.",
    image: '/pictures/me-irl.jpg',
    Content: AboutMeContent,
    listed: true,
  },
  {
    slug: 'random-ramblings',
    category: 'Personal',
    status: 'Ongoing',
    title: 'Random Ramblings',
    date: 'April 23, 2026',
    lastUpdated: 'May 26, 2026',
    excerpt:
      'This is a collection of random thoughts that I have had recently. They are not necessarily related to each other or to anything in particular, but I thought it would be fun to share them anyway.',
    image: '/pictures/blurry-shiba.JPG',
    Content: RandomRamblingsContent,
    listed: true,
  },
  {
    slug: 'learning-claude',
    category: 'Journal',
    status: 'Ongoing',
    title: 'Learning Claude',
    date: 'April 23, 2026',
    lastUpdated: 'April 25, 2026',
    excerpt:
      'I am currently learning how to work with Claude and making things like skills and agents and thought I should document my progress. This is a journal of my learning process.',
    image: '/pictures/claude.png',
    Content: LearningClaudeContent,
    listed: false,
  },
];

export function getListedPosts() {
  return posts.filter((post) => post.listed);
}

export function getPostBySlug(slug) {
  return posts.find((post) => post.slug === slug);
}
