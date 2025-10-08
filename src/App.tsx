import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MovieDetail from "./pages/MovieDetail";
import NotFound from "./pages/NotFound";
import Trending from "./pages/Trending";
import WatchHistory from "./pages/WatchHistory";
import { MyListProvider } from './contexts/MyListContext';
import { WatchHistoryProvider } from './contexts/WatchHistoryContext';
import { StreamingPage } from './pages/StreamingPage';
import { useDevToolsProtection } from '@/hooks/useDevToolsProtection';
import More from './pages/More';

const App = () => {
  useDevToolsProtection();

  return (
    <MyListProvider>
      <WatchHistoryProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/watch-history" element={<WatchHistory />} />
            <Route path="/watch" element={<StreamingPage />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </WatchHistoryProvider>
    </MyListProvider>
  );
};

export default App;
