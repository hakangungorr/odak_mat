import { Routes, Route, Link } from "react-router-dom";
import HealthPage from "./pages/HealthPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import TeacherPage from "./pages/TeacherPage.jsx";
import ParentPage from "./pages/ParentPage.jsx";

export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Health</Link>
        <Link to="/login">Login</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/teacher">Teacher</Link>
        <Link to="/parent">Parent</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HealthPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/parent" element={<ParentPage />} />
      </Routes>
    </div>
  );
}


