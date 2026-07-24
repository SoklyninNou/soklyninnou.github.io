import { Route, Routes } from 'react-router-dom';
import SiteLayout from './components/layout/SiteLayout.jsx';
import Home from './pages/Home.jsx';
import Courses from './pages/Courses/Courses.jsx';
import Experience from './pages/Experience/Experience.jsx';
import Research from './pages/Research/Research.jsx';
import BlogList from './pages/Blog/BlogList.jsx';
import BlogPost from './pages/Blog/BlogPost.jsx';
import GymTracker from './pages/GymTracker.jsx';
import Mambo from './pages/Mambo.jsx';
import ScreenSaver from './pages/ScreenSaver.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/experience" element={<Experience />} />
        <Route path="/research" element={<Research />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/gym-workout-tracker" element={<GymTracker />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/mambo" element={<Mambo />} />
      <Route path="/screen-saver" element={<ScreenSaver />} />
    </Routes>
  );
}
