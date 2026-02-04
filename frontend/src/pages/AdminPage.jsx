import React, { useEffect, useMemo, useState } from "react";
import {
    getStudents,
    createStudent,
    getTeachers,
    createTeacher,
    getEnrollments,
    createEnrollment,
} from "../api/admin";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

function normalizeId(x) {
    // backend bazen id, bazen user_id döndürebilir
    return x?.id ?? x?.user_id ?? x?.teacher_user_id ?? x?.student_id ?? null;
}

export default function AdminPage() {
    const nav = useNavigate();
    const { user } = loadAuth();

    const [tab, setTab] = useState("teachers"); // teachers | students | link
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [enrollments, setEnrollments] = useState([]);

    const [expandedTeacherId, setExpandedTeacherId] = useState(null);

    // forms
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentGrade, setNewStudentGrade] = useState("");
    const [newStudentUserId, setNewStudentUserId] = useState("");

    const [newTeacherName, setNewTeacherName] = useState("");
    const [newTeacherEmail, setNewTeacherEmail] = useState("");
    const [newTeacherPassword, setNewTeacherPassword] = useState("");

    const [linkTeacherId, setLinkTeacherId] = useState("");
    const [linkStudentId, setLinkStudentId] = useState("");

    async function loadAll() {
        setLoading(true);
        setErr("");
        try {
            const [t, s, e] = await Promise.all([
                getTeachers(),
                getStudents(),
                getEnrollments(),
            ]);
            setTeachers(Array.isArray(t) ? t : (t?.items ?? []));
            setStudents(Array.isArray(s) ? s : (s?.items ?? []));
            setEnrollments(Array.isArray(e) ? e : (e?.items ?? []));
        } catch (ex) {
            setErr(ex?.message || "Yükleme hatası");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    // teacherId -> studentIds map
    const teacherToStudentIds = useMemo(() => {
        const map = new Map();
        for (const en of enrollments) {
            const tId = en.teacher_user_id ?? en.teacher_id ?? en.teacherId ?? en.teacher?.id;
            const sId = en.student_id ?? en.studentId ?? en.student?.id;
            if (!tId || !sId) continue;
            if (!map.has(tId)) map.set(tId, []);
            map.get(tId).push(sId);
        }
        return map;
    }, [enrollments]);

    function studentsOfTeacher(teacher) {
        const tId = teacher.id ?? teacher.user_id;
        const sIds = teacherToStudentIds.get(tId) || [];
        const setIds = new Set(sIds);
        return students.filter((st) => setIds.has(st.id));
    }

    async function onCreateStudent(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                full_name: newStudentName,
                grade: newStudentGrade ? Number(newStudentGrade) : null,
                // sende "öğrenci user_id ile bağlanır" demiştik; varsa gönder:
                user_id: newStudentUserId ? Number(newStudentUserId) : undefined,
            };
            // boş undefined alanları temizle
            Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

            await createStudent(payload);
            setNewStudentName("");
            setNewStudentGrade("");
            setNewStudentUserId("");
            await loadAll();
            setTab("students");
        } catch (ex) {
            setErr(ex?.message || "Öğrenci oluşturma hatası");
        }
    }

    async function onCreateTeacher(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                full_name: newTeacherName,
                email: newTeacherEmail,
                password: newTeacherPassword,
                role: "TEACHER", // backend bunu kendisi setliyorsa kaldırabilirsin
            };
            await createTeacher(payload);
            setNewTeacherName("");
            setNewTeacherEmail("");
            setNewTeacherPassword("");
            await loadAll();
            setTab("teachers");
        } catch (ex) {
            setErr(ex?.message || "Öğretmen oluşturma hatası");
        }
    }

    async function onCreateLink(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                teacher_user_id: Number(linkTeacherId),
                student_id: Number(linkStudentId),
            };
            await createEnrollment(payload);
            setLinkTeacherId("");
            setLinkStudentId("");
            await loadAll();
            setTab("teachers");
        } catch (ex) {
            setErr(ex?.message || "Eşleştirme hatası");
        }
    }

    function onLogout() {
        logout();
        nav("/login");
    }

    return (
        <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0 }}>Admin Panel</h2>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                        {user?.email || "admin"} · {user?.role || "ADMIN"}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={loadAll} disabled={loading}>Yenile</button>
                    <button onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => setTab("teachers")} style={{ fontWeight: tab === "teachers" ? "700" : "400" }}>
                    Öğretmenler
                </button>
                <button onClick={() => setTab("students")} style={{ fontWeight: tab === "students" ? "700" : "400" }}>
                    Öğrenciler
                </button>
                <button onClick={() => setTab("link")} style={{ fontWeight: tab === "link" ? "700" : "400" }}>
                    Öğretmen-Öğrenci Eşleştir
                </button>
            </div>

            {err ? (
                <div style={{ marginTop: 12, color: "crimson" }}>{err}</div>
            ) : null}

            {loading ? (
                <div style={{ marginTop: 12 }}>Yükleniyor…</div>
            ) : null}

            {/* TEACHERS TAB */}
            {tab === "teachers" && !loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                    {/* Teacher List */}
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğretmenler ({teachers.length})</h3>

                        {teachers.length === 0 ? <div>Öğretmen yok.</div> : null}

                        <div style={{ display: "grid", gap: 8 }}>
                            {teachers.map((t) => {
                                const tid = t.id ?? t.user_id;
                                const isOpen = expandedTeacherId === tid;
                                const linked = studentsOfTeacher(t);

                                return (
                                    <div key={tid} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 10 }}>
                                        <div
                                            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
                                            onClick={() => setExpandedTeacherId(isOpen ? null : tid)}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>
                                                    {t.full_name || t.name || "İsimsiz öğretmen"}
                                                </div>
                                                <div style={{ fontSize: 13, opacity: 0.75 }}>
                                                    {t.email || ""}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                                                {linked.length} öğrenci
                                            </div>
                                        </div>

                                        {isOpen && (
                                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #eee" }}>
                                                <div style={{ fontWeight: 600, marginBottom: 6 }}>Bağlı Öğrenciler</div>
                                                {linked.length === 0 ? (
                                                    <div style={{ fontSize: 13, opacity: 0.75 }}>Henüz bağlı öğrenci yok.</div>
                                                ) : (
                                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                        {linked.map((s) => (
                                                            <li key={s.id}>
                                                                {s.full_name}{" "}
                                                                <span style={{ fontSize: 12, opacity: 0.7 }}>
                                                                    (Sınıf: {s.grade ?? "-"})
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Create Teacher */}
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğretmen Oluştur</h3>
                        <form onSubmit={onCreateTeacher} style={{ display: "grid", gap: 10 }}>
                            <input
                                placeholder="Ad Soyad"
                                value={newTeacherName}
                                onChange={(e) => setNewTeacherName(e.target.value)}
                            />
                            <input
                                placeholder="Email"
                                value={newTeacherEmail}
                                onChange={(e) => setNewTeacherEmail(e.target.value)}
                            />
                            <input
                                placeholder="Şifre"
                                type="password"
                                value={newTeacherPassword}
                                onChange={(e) => setNewTeacherPassword(e.target.value)}
                            />
                            <button>Oluştur</button>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Not: Backend öğretmeni “User” olarak oluşturuyorsa bu endpoint onu yapmalı.
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STUDENTS TAB */}
            {tab === "students" && !loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrenciler ({students.length})</h3>

                        {students.length === 0 ? <div>Öğrenci yok.</div> : null}

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ad Soyad</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sınıf</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.full_name}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.grade ?? "-"}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.id}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrenci Oluştur</h3>
                        <form onSubmit={onCreateStudent} style={{ display: "grid", gap: 10 }}>
                            <input
                                placeholder="Ad Soyad"
                                value={newStudentName}
                                onChange={(e) => setNewStudentName(e.target.value)}
                            />
                            <input
                                placeholder="Sınıf (ör: 8)"
                                value={newStudentGrade}
                                onChange={(e) => setNewStudentGrade(e.target.value)}
                            />
                            <input
                                placeholder="User ID (opsiyonel)"
                                value={newStudentUserId}
                                onChange={(e) => setNewStudentUserId(e.target.value)}
                            />
                            <button>Oluştur</button>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Not: Eğer öğrenci için ayrı login hesabı da üretilecekse backend bunu da burada yapabilir.
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LINK TAB */}
            {tab === "link" && !loading && (
                <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Öğretmen-Öğrenci Eşleştir</h3>

                    <form onSubmit={onCreateLink} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "center" }}>
                        <select value={linkTeacherId} onChange={(e) => setLinkTeacherId(e.target.value)}>
                            <option value="">Öğretmen seç</option>
                            {teachers.map((t) => {
                                const tid = t.id ?? t.user_id;
                                return (
                                    <option key={tid} value={tid}>
                                        {t.full_name || t.name} ({t.email || tid})
                                    </option>
                                );
                            })}
                        </select>

                        <select value={linkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}>
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name} (Sınıf: {s.grade ?? "-"})
                                </option>
                            ))}
                        </select>

                        <button disabled={!linkTeacherId || !linkStudentId}>Eşleştir</button>
                    </form>

                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                        Bu işlem backend’de `POST /api/enrollments` ile teacher_user_id + student_id gönderir.
                    </div>
                </div>
            )}
        </div>
    );
}
