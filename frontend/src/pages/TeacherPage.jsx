import React, { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

export default function TeacherPage() {
    const nav = useNavigate();
    const { token, user } = loadAuth();

    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [studentPackages, setStudentPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [sessionErr, setSessionErr] = useState("");

    const [sessionStudentId, setSessionStudentId] = useState("");
    const [sessionStart, setSessionStart] = useState("");
    const [sessionDuration, setSessionDuration] = useState("60");
    const [sessionMode, setSessionMode] = useState("ONLINE");
    const [sessionTopic, setSessionTopic] = useState("");

    const [profileLevel, setProfileLevel] = useState("");
    const [profileTarget, setProfileTarget] = useState("");
    const [profileStrengths, setProfileStrengths] = useState("");
    const [profileWeaknesses, setProfileWeaknesses] = useState("");

    const [reportSessionId, setReportSessionId] = useState("");
    const [reportTopic, setReportTopic] = useState("");
    const [reportRating, setReportRating] = useState("5");
    const [reportNote, setReportNote] = useState("");
    const [reportNext, setReportNext] = useState("");

    const [hwStudentId, setHwStudentId] = useState("");
    const [hwTitle, setHwTitle] = useState("");
    const [hwDesc, setHwDesc] = useState("");
    const [hwDue, setHwDue] = useState("");

    const [markInputs, setMarkInputs] = useState({});

    async function loadStudents() {
        setLoading(true);
        setErr("");
        try {
            const data = await apiFetch("/api/students", {
                method: "GET",
                token,
            });
            setStudents(Array.isArray(data) ? data : (data?.items ?? []));
            if (!selectedStudentId && Array.isArray(data) && data.length > 0) {
                setSelectedStudentId(data[0].id);
                setSessionStudentId(String(data[0].id));
            }
        } catch (ex) {
            setErr(ex?.message || "Öğrenciler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }

    async function loadSessions() {
        setSessionErr("");
        try {
            const data = await apiFetch("/api/lesson-sessions", {
                method: "GET",
                token,
            });
            setSessions(Array.isArray(data) ? data : (data?.items ?? []));
        } catch (ex) {
            setSessionErr(ex?.message || "Dersler yüklenemedi");
        }
    }

    async function loadReports() {
        try {
            const data = await apiFetch("/api/lesson-reports", { method: "GET", token });
            setReports(Array.isArray(data) ? data : (data?.items ?? []));
        } catch {}
    }

    async function loadHomeworks() {
        try {
            const data = await apiFetch("/api/homeworks", { method: "GET", token });
            setHomeworks(Array.isArray(data) ? data : (data?.items ?? []));
        } catch {}
    }

    async function loadStudentPackages(studentId) {
        if (!studentId) {
            setStudentPackages([]);
            return;
        }
        try {
            const data = await apiFetch(`/api/packages/student-packages?student_id=${studentId}`, {
                method: "GET",
                token,
            });
            setStudentPackages(Array.isArray(data) ? data : (data?.items ?? []));
        } catch {
            setStudentPackages([]);
        }
    }

    useEffect(() => {
        loadStudents();
        loadSessions();
        loadReports();
        loadHomeworks();
    }, []);

    function onLogout() {
        logout();
        nav("/login");
    }

    async function onCreateSession(e) {
        e.preventDefault();
        setSessionErr("");

        try {
            const payload = {
                student_id: Number(sessionStudentId),
                scheduled_start: sessionStart,
                duration_min: Number(sessionDuration),
                mode: sessionMode,
                topic: sessionTopic || undefined,
            };
            await apiFetch("/api/lesson-sessions", {
                method: "POST",
                token,
                body: payload,
            });
            setSessionStart("");
            setSessionDuration("60");
            setSessionMode("ONLINE");
            setSessionTopic("");
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders oluşturma hatası");
        }
    }

    async function onTeacherMark(sessionId) {
        setSessionErr("");
        try {
            const payload = markInputs[sessionId] || {};
            await apiFetch(`/api/lesson-sessions/${sessionId}/teacher-mark`, {
                method: "PATCH",
                token,
                body: {
                    teacher_rating_to_student: payload.rating ? Number(payload.rating) : undefined,
                    teacher_mark_note: payload.note || undefined,
                },
            });
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders işaretleme hatası");
        }
    }

    async function onTeacherCancel(sessionId) {
        const ok = window.confirm("Dersi iptal etmek istiyor musun? Öğrencinin hakkı düşmez.");
        if (!ok) return;
        setSessionErr("");
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/cancel`, {
                method: "PATCH",
                token,
                body: {},
            });
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders iptal hatası");
        }
    }

    async function onUpdateProfile(e) {
        e.preventDefault();
        if (!selectedStudentId) return;
        try {
            await apiFetch(`/api/students/${selectedStudentId}`, {
                method: "PATCH",
                token,
                body: {
                    level: profileLevel,
                    target_exam: profileTarget,
                    strengths: profileStrengths,
                    weaknesses: profileWeaknesses,
                },
            });
            await loadStudents();
        } catch (ex) {
            setSessionErr(ex?.message || "Profil güncelleme hatası");
        }
    }

    async function onCreateReport(e) {
        e.preventDefault();
        try {
            await apiFetch("/api/lesson-reports", {
                method: "POST",
                token,
                body: {
                    lesson_session_id: Number(reportSessionId),
                    topic: reportTopic,
                    performance_rating: Number(reportRating),
                    teacher_note: reportNote,
                    next_note: reportNext,
                },
            });
            setReportSessionId("");
            setReportTopic("");
            setReportRating("5");
            setReportNote("");
            setReportNext("");
            await loadReports();
        } catch (ex) {
            setSessionErr(ex?.message || "Rapor oluşturma hatası");
        }
    }

    async function onCreateHomework(e) {
        e.preventDefault();
        try {
            await apiFetch("/api/homeworks", {
                method: "POST",
                token,
                body: {
                    student_id: Number(hwStudentId),
                    title: hwTitle,
                    description: hwDesc,
                    due_date: hwDue || undefined,
                },
            });
            setHwStudentId("");
            setHwTitle("");
            setHwDesc("");
            setHwDue("");
            await loadHomeworks();
        } catch (ex) {
            setSessionErr(ex?.message || "Ödev oluşturma hatası");
        }
    }

    useEffect(() => {
        const s = students.find((x) => x.id === selectedStudentId);
        if (s) {
            setProfileLevel(s.level || "");
            setProfileTarget(s.target_exam || "");
            setProfileStrengths(s.strengths || "");
            setProfileWeaknesses(s.weaknesses || "");
        }
        loadStudentPackages(selectedStudentId);
    }, [selectedStudentId, students]);

    const selectedStudent = students.find((s) => s.id === selectedStudentId) || null;
    const studentNameById = new Map(students.map((s) => [s.id, s.full_name]));
    const activeStudentPackage = studentPackages.find((sp) => sp.status === "ACTIVE") || studentPackages[0];

    const pendingTeacher = sessions.filter((s) => !s.teacher_marked_at && !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status));
    const pendingStudent = sessions.filter((s) => s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCompleted = sessions.filter((s) => {
        if (s.status !== "COMPLETED") return false;
        const d = s.scheduled_start ? new Date(s.scheduled_start) : null;
        return d && d >= monthStart;
    }).length;
    const rate = Number(user?.teacher_rate || 0);
    const monthEarning = rate * monthCompleted;

    return (
        <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0 }}>Öğretmen Paneli</h2>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                        {user?.email || "teacher"} · {user?.role || "TEACHER"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={loadStudents} disabled={loading}>Yenile</button>
                    <button onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {err ? <div style={{ marginTop: 12, color: "crimson" }}>{err}</div> : null}
            {loading ? <div style={{ marginTop: 12 }}>Yükleniyor…</div> : null}

            {!loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrencilerim ({students.length})</h3>
                        {students.length === 0 ? (
                            <div>Henüz atanmış öğrencin yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ad Soyad</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sınıf</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Email</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s) => (
                                        <tr
                                            key={s.id}
                                            onClick={() => setSelectedStudentId(s.id)}
                                            style={{
                                                cursor: "pointer",
                                                background: selectedStudentId === s.id ? "#f7f7f7" : "transparent",
                                            }}
                                        >
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.full_name}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.grade ?? "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.email || "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.id}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrenci Detayı</h3>
                        {selectedStudent ? (
                            <div style={{ display: "grid", gap: 6 }}>
                                <div><strong>Ad Soyad:</strong> {selectedStudent.full_name}</div>
                                <div><strong>Email:</strong> {selectedStudent.email || "-"}</div>
                                <div><strong>Sınıf:</strong> {selectedStudent.grade ?? "-"}</div>
                                <div><strong>Seviye:</strong> {selectedStudent.level || "-"}</div>
                                <div><strong>Hedef Sınav:</strong> {selectedStudent.target_exam || "-"}</div>
                                <div><strong>ID:</strong> {selectedStudent.id}</div>
                                <div><strong>Kalan Ders Hakkı:</strong> {activeStudentPackage?.remaining_lessons ?? "-"}</div>
                            </div>
                        ) : (
                            <div>Bir öğrenci seç.</div>
                        )}
                        {selectedStudent ? (
                            <form onSubmit={onUpdateProfile} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                                <input placeholder="Seviye" value={profileLevel} onChange={(e) => setProfileLevel(e.target.value)} />
                                <input placeholder="Hedef sınav" value={profileTarget} onChange={(e) => setProfileTarget(e.target.value)} />
                                <textarea placeholder="Güçlü konular" value={profileStrengths} onChange={(e) => setProfileStrengths(e.target.value)} />
                                <textarea placeholder="Zayıf konular" value={profileWeaknesses} onChange={(e) => setProfileWeaknesses(e.target.value)} />
                                <button>Profili Güncelle</button>
                            </form>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Lesson Sessions */}
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Derslerim ({sessions.length})</h3>
                    {(pendingTeacher.length > 0 || pendingStudent.length > 0) && (
                        <div style={{ marginBottom: 10, fontSize: 13, color: "#7c2d12" }}>
                            {pendingTeacher.length > 0 && (
                                <div>Senin onayını bekleyen ders: {pendingTeacher.length}</div>
                            )}
                            {pendingStudent.length > 0 && (
                                <div>Öğrenci onayı bekleyen ders: {pendingStudent.length}</div>
                            )}
                        </div>
                    )}
                    {sessionErr ? <div style={{ color: "crimson" }}>{sessionErr}</div> : null}
                    {sessions.length === 0 ? (
                        <div>Henüz ders oluşturulmadı.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Mod</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Puan</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Not</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>İptal Eden</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s) => {
                                    const statusColor = {
                                        PLANNED: "#2563eb",
                                        PENDING_CONFIRMATION: "#b45309",
                                        COMPLETED: "#15803d",
                                        CANCELLED: "#b91c1c",
                                        MISSED: "#6b7280",
                                    }[s.status] || "#111827";
                                    const canMark = !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status);
                                    const canCancel = !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status);
                                    return (
                                        <tr key={s.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.scheduled_start?.replace("T", " ").slice(0, 16) || "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {studentNameById.get(s.student_id) || `#${s.student_id}`}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.duration_min} dk
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.mode}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                <span style={{
                                                    display: "inline-block",
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    background: statusColor + "22",
                                                    color: statusColor,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="5"
                                                    value={markInputs[s.id]?.rating || ""}
                                                    onChange={(e) =>
                                                        setMarkInputs((prev) => ({
                                                            ...prev,
                                                            [s.id]: { ...(prev[s.id] || {}), rating: e.target.value },
                                                        }))
                                                    }
                                                    style={{ width: 60 }}
                                                />
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                <input
                                                    value={markInputs[s.id]?.note || ""}
                                                    onChange={(e) =>
                                                        setMarkInputs((prev) => ({
                                                            ...prev,
                                                            [s.id]: { ...(prev[s.id] || {}), note: e.target.value },
                                                        }))
                                                    }
                                                    placeholder="Not"
                                                />
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {s.cancelled_by_role || "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                <button
                                                    disabled={!canMark || !!s.teacher_marked_at}
                                                    onClick={() => onTeacherMark(s.id)}
                                                >
                                                    {s.teacher_marked_at ? "İşaretlendi" : "Dersi Yaptım"}
                                                </button>
                                                <button
                                                    style={{ marginLeft: 6 }}
                                                    disabled={!canCancel}
                                                    onClick={() => onTeacherCancel(s.id)}
                                                >
                                                    İptal Et
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ders Planla</h3>
                    <form onSubmit={onCreateSession} style={{ display: "grid", gap: 10 }}>
                        <select
                            value={sessionStudentId}
                            onChange={(e) => setSessionStudentId(e.target.value)}
                        >
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="datetime-local"
                            value={sessionStart}
                            onChange={(e) => setSessionStart(e.target.value)}
                        />
                        <input
                            type="number"
                            min="15"
                            step="5"
                            value={sessionDuration}
                            onChange={(e) => setSessionDuration(e.target.value)}
                            placeholder="Süre (dk)"
                        />
                        <select
                            value={sessionMode}
                            onChange={(e) => setSessionMode(e.target.value)}
                        >
                            <option value="ONLINE">ONLINE</option>
                            <option value="IN_PERSON">IN_PERSON</option>
                        </select>
                        <input
                            placeholder="Konu (opsiyonel)"
                            value={sessionTopic}
                            onChange={(e) => setSessionTopic(e.target.value)}
                        />
                        <button disabled={!sessionStudentId || !sessionStart}>
                            Oluştur
                        </button>
                    </form>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                        Tarih formatı: tarayıcının `datetime-local` değeri otomatik ISO format olur.
                    </div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Bu Ay Kazanç</h3>
                    <div><strong>Ders sayısı:</strong> {monthCompleted}</div>
                    <div><strong>Ücret/Ders:</strong> {rate || "-"}</div>
                    <div><strong>Toplam:</strong> {monthEarning || "-"}</div>
                </div>
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ders Raporları ({reports.length})</h3>
                    {reports.length === 0 ? (
                        <div>Henüz rapor yok.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Konu</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Puan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {studentNameById.get(r.student_id) || `#${r.student_id}`}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.topic || "-"}</td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.performance_rating ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ders Sonu Raporu</h3>
                    <form onSubmit={onCreateReport} style={{ display: "grid", gap: 10 }}>
                        <select value={reportSessionId} onChange={(e) => setReportSessionId(e.target.value)}>
                            <option value="">Ders seç</option>
                            {sessions.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {studentNameById.get(s.student_id) || `#${s.student_id}`} · {s.scheduled_start?.replace("T", " ").slice(0, 16)}
                                </option>
                            ))}
                        </select>
                        <input placeholder="İşlenen konu" value={reportTopic} onChange={(e) => setReportTopic(e.target.value)} />
                        <input type="number" min="1" max="5" value={reportRating} onChange={(e) => setReportRating(e.target.value)} />
                        <textarea placeholder="Öğretmen notu" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
                        <textarea placeholder="Bir sonraki ders notu" value={reportNext} onChange={(e) => setReportNext(e.target.value)} />
                        <button disabled={!reportSessionId}>Kaydet</button>
                    </form>
                </div>
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ödevler ({homeworks.length})</h3>
                    {homeworks.length === 0 ? (
                        <div>Ödev yok.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Başlık</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {homeworks.map((h) => (
                                    <tr key={h.id}>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {studentNameById.get(h.student_id) || `#${h.student_id}`}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.title}</td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ödev Ver</h3>
                    <form onSubmit={onCreateHomework} style={{ display: "grid", gap: 10 }}>
                        <select value={hwStudentId} onChange={(e) => setHwStudentId(e.target.value)}>
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name}
                                </option>
                            ))}
                        </select>
                        <input placeholder="Başlık" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} />
                        <textarea placeholder="Açıklama" value={hwDesc} onChange={(e) => setHwDesc(e.target.value)} />
                        <input type="datetime-local" value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
                        <button disabled={!hwStudentId || !hwTitle}>Ödev Oluştur</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
