import React, { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const nav = useNavigate();
    const { token, user } = loadAuth();

    const [student, setStudent] = useState(null);
    const [enrollments, setEnrollments] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [reports, setReports] = useState([]);
    const [packages, setPackages] = useState([]);
    const [packageDefs, setPackageDefs] = useState([]);
    const [markInputs, setMarkInputs] = useState({});
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    async function loadData() {
        setLoading(true);
        setErr("");
        try {
            const [me, enr, sess, hws, reps, pkgs, defs] = await Promise.all([
                apiFetch("/api/students/me", { method: "GET", token }),
                apiFetch("/api/enrollments", { method: "GET", token }),
                apiFetch("/api/lesson-sessions", { method: "GET", token }),
                apiFetch("/api/homeworks", { method: "GET", token }),
                apiFetch("/api/lesson-reports", { method: "GET", token }),
                apiFetch("/api/packages/student-packages", { method: "GET", token }),
                apiFetch("/api/packages", { method: "GET", token }),
            ]);
            setStudent(me || null);
            setEnrollments(Array.isArray(enr) ? enr : (enr?.items ?? []));
            setSessions(Array.isArray(sess) ? sess : (sess?.items ?? []));
            setHomeworks(Array.isArray(hws) ? hws : (hws?.items ?? []));
            setReports(Array.isArray(reps) ? reps : (reps?.items ?? []));
            setPackages(Array.isArray(pkgs) ? pkgs : (pkgs?.items ?? []));
            setPackageDefs(Array.isArray(defs) ? defs : (defs?.items ?? []));
        } catch (ex) {
            setErr(ex?.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    function onLogout() {
        logout();
        nav("/login");
    }

    const activeEnrollment = enrollments.find((e) => e.status === "ACTIVE") || enrollments[0];
    const teacher = activeEnrollment?.teacher || null;
    const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
    const plannedCount = sessions.filter((s) => s.status === "PLANNED").length;
    const completionRate = sessions.length ? Math.round((completedCount / sessions.length) * 100) : 0;
    const activePackage = packages.find((p) => p.status === "ACTIVE") || null;

    async function onStudentMark(sessionId) {
        try {
            const payload = markInputs[sessionId] || {};
            await apiFetch(`/api/lesson-sessions/${sessionId}/student-mark`, {
                method: "PATCH",
                token,
                body: {
                    student_rating_to_teacher: payload.rating ? Number(payload.rating) : undefined,
                    student_note: payload.note || undefined,
                    done: true,
                },
            });
            await loadData();
        } catch (ex) {
            setErr(ex?.message || "Ders onaylama hatası");
        }
    }

    async function onStudentCancel(sessionId) {
        const ok = window.confirm("Dersi iptal etmek istiyor musun? Ders başlangıcına 2 saat kaldıysa hakkın düşer.");
        if (!ok) return;
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/cancel`, {
                method: "PATCH",
                token,
                body: {},
            });
            await loadData();
        } catch (ex) {
            setErr(ex?.message || "Ders iptal hatası");
        }
    }

    async function onStudentNoShow(sessionId) {
        const ok = window.confirm("Ders yapılmadı olarak işaretlemek istiyor musun?");
        if (!ok) return;
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/student-mark`, {
                method: "PATCH",
                token,
                body: { done: false },
            });
            await loadData();
        } catch (ex) {
            setErr(ex?.message || "Ders yapılmadı hatası");
        }
    }

    const pendingForStudent = sessions.filter((s) => s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION");

    return (
        <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0 }}>Öğrenci Paneli</h2>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                        {user?.email || "student"} · {user?.role || "STUDENT"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={loadData} disabled={loading}>Yenile</button>
                    <button onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {err ? <div style={{ marginTop: 12, color: "crimson" }}>{err}</div> : null}
            {loading ? <div style={{ marginTop: 12 }}>Yükleniyor…</div> : null}

            {!loading && (
                <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Profil</h3>
                        {student ? (
                            <div style={{ display: "grid", gap: 6 }}>
                                <div><strong>Ad Soyad:</strong> {student.full_name}</div>
                                <div><strong>Sınıf:</strong> {student.grade ?? "-"}</div>
                                <div><strong>Öğrenci ID:</strong> {student.id}</div>
                            </div>
                        ) : (
                            <div>Profil bulunamadı.</div>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğretmen Bilgisi</h3>
                        {activeEnrollment ? (
                            <div style={{ display: "grid", gap: 6 }}>
                                <div><strong>Ad Soyad:</strong> {teacher?.full_name || "-"}</div>
                                <div><strong>Email:</strong> {teacher?.email || "-"}</div>
                                <div><strong>Öğretmen ID:</strong> {activeEnrollment.teacher_user_id}</div>
                                <div><strong>Durum:</strong> {activeEnrollment.status}</div>
                            </div>
                        ) : (
                            <div>Henüz öğretmen ataması yok.</div>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>İlerleme</h3>
                        <div><strong>Toplam ders:</strong> {sessions.length}</div>
                        <div><strong>Tamamlanan:</strong> {completedCount}</div>
                        <div><strong>Planlanan:</strong> {plannedCount}</div>
                        <div><strong>Başarı oranı:</strong> %{completionRate}</div>
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Derslerim ({sessions.length})</h3>
                        {pendingForStudent.length > 0 && (
                            <div style={{ marginBottom: 10, fontSize: 13, color: "#7c2d12" }}>
                                Onayını bekleyen ders: {pendingForStudent.length}
                            </div>
                        )}
                        {packages.find((p) => p.status === "ACTIVE")?.remaining_lessons !== 1 && (
                            <div style={{ marginBottom: 10, fontSize: 13, color: "#6b7280" }}>
                                Not ve puan vermek için kalan ders hakkın 1 olmalı. Onaylama her zaman yapılabilir.
                            </div>
                        )}
                        {sessions.length === 0 ? (
                            <div>Henüz ders planı yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Mod</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen Notu</th>
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
                                        const canCancel = !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status) && !s.teacher_marked_at;
                                        const remaining = activePackage?.remaining_lessons;
                                        const canRate = remaining === 1;
                                        const canConfirm = s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION";
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {s.scheduled_start?.replace("T", " ").slice(0, 16) || "-"}
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
                                                    {s.teacher_mark_note || "-"}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {canRate && canConfirm ? (
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
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {canRate && canConfirm ? (
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
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {s.cancelled_by_role || "-"}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    <button
                                                        disabled={!canMark || !!s.student_marked_at || !canConfirm}
                                                        onClick={() => onStudentMark(s.id)}
                                                    >
                                                        {s.student_marked_at ? "Onaylandı" : "Dersi Onayla"}
                                                    </button>
                                                    <button
                                                        style={{ marginLeft: 6 }}
                                                        disabled={!canConfirm}
                                                        onClick={() => onStudentNoShow(s.id)}
                                                    >
                                                        Yapılmadı
                                                    </button>
                                                    <button
                                                        style={{ marginLeft: 6 }}
                                                        disabled={!canCancel}
                                                        onClick={() => onStudentCancel(s.id)}
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
                        <h3 style={{ marginTop: 0 }}>Ödevlerim ({homeworks.length})</h3>
                        {homeworks.length === 0 ? (
                            <div>Ödev yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Başlık</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {homeworks.map((h) => (
                                        <tr key={h.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.title}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Ders Raporları ({reports.length})</h3>
                        {reports.length === 0 ? (
                            <div>Rapor yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Konu</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Puan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.topic || "-"}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.performance_rating ?? "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Paketlerim ({packages.length})</h3>
                        {packages.length === 0 ? (
                            <div>Paket yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Paket</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Kalan</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {packages.map((p) => {
                                    const def = packageDefs.find((d) => d.id === p.package_id);
                                    return (
                                    <tr key={p.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{def?.name || p.package_id}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.remaining_lessons}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.status}</td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
