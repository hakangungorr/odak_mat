import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth/authStore";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    async function handleLogin(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const auth = await login(email, password);

            // role bazlı yönlendirme
            const role = auth.user?.role;
            if (role === "ADMIN") navigate("/admin");
            else if (role === "TEACHER") navigate("/teacher");
            else navigate("/");
        } catch (err) {
            setError(err.message || "Giriş başarısız");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleLogin}>
            <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
            />

            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
            />

            {error && <div style={{ color: "red" }}>{error}</div>}

            <button disabled={loading}>
                {loading ? "Giriş yapılıyor..." : "Giriş"}
            </button>
        </form>
    );
}
