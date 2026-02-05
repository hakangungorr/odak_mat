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
    const [externalEvents, setExternalEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    async function loadData() {
        setLoading(true);
        setErr("");
        try {
            const [me, enr, sess, hws, reps, pkgs, defs, cal] = await Promise.all([
                apiFetch("/api/students/me", { method: "GET", token }),
                apiFetch("/api/enrollments", { method: "GET", token }),
                apiFetch("/api/lesson-sessions", { method: "GET", token }),
                apiFetch("/api/homeworks", { method: "GET", token }),
                apiFetch("/api/lesson-reports", { method: "GET", token }),
                apiFetch("/api/packages/student-packages", { method: "GET", token }),
                apiFetch("/api/packages", { method: "GET", token }),
                apiFetch("/api/calendar/public-calendar", { method: "GET", token }),
            ]);
            setStudent(me || null);
            setEnrollments(Array.isArray(enr) ? enr : (enr?.items ?? []));
            const sessItems = Array.isArray(sess) ? sess : (sess?.items ?? []);
            const now = new Date();
            setSessions(
                sessItems.filter((s) => {
                    if (s.status === "COMPLETED") return false;
                    if (!s.scheduled_start) return true;
                    const dt = new Date(s.scheduled_start);
                    if (Number.isNaN(dt.getTime())) return true;
                    return dt >= now;
                })
            );
            setHomeworks(Array.isArray(hws) ? hws : (hws?.items ?? []));
            setReports(Array.isArray(reps) ? reps : (reps?.items ?? []));
            setPackages(Array.isArray(pkgs) ? pkgs : (pkgs?.items ?? []));
            setPackageDefs(Array.isArray(defs) ? defs : (defs?.items ?? []));
            setExternalEvents(Array.isArray(cal?.items) ? cal.items : []);
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

    function formatDatePart(iso) {
        if (!iso) return "-";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString();
    }

    function formatTimePart(iso) {
        if (!iso) return "-";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function groupSessionsByDate(items) {
        const map = new Map();
        for (const s of items) {
            const key = formatDatePart(s.scheduled_start);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(s);
        }
        return Array.from(map.entries());
    }
    const [monthOffset, setMonthOffset] = useState(0);

    function buildMonthDays(offset = 0) {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        const days = [];
        const startDay = first.getDay();
        for (let i = 0; i < startDay; i += 1) days.push(null);
        for (let d = 1; d <= last.getDate(); d += 1) {
            days.push(new Date(first.getFullYear(), first.getMonth(), d));
        }
        return { first, days };
    }

    function toKey(d) {
        return d.toISOString().slice(0, 10);
    }

    function mergeCalendarItems() {
        const items = [];
        sessions.forEach((s) => {
            if (!s.scheduled_start) return;
            items.push({
                date: s.scheduled_start.slice(0, 10),
                time: formatTimePart(s.scheduled_start),
                title: s.topic ? `Ders: ${s.topic}` : "Ders",
                type: "lesson",
            });
        });
        externalEvents.forEach((e) => {
            if (!e.start) return;
            items.push({
                date: e.start.slice(0, 10),
                time: formatTimePart(e.start),
                title: e.summary || "Etkinlik",
                type: "external",
            });
        });
        return items;
    }

    async function onStudentMark(sessionId) {
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/student-mark`, {
                method: "PATCH",
                token,
                body: {
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
                        {sessions.length === 0 ? (
                            <div>Henüz ders planı yok.</div>
                        ) : (
                            <table className="table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Saat</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Konu</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Mod</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen Notu</th>
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
                                        const canConfirm = s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION";
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {formatDatePart(s.scheduled_start)}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {formatTimePart(s.scheduled_start)}
                                                </td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {s.topic || "-"}
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
                        <div className="stack-cards">
                            {sessions.map((s) => (
                                <div key={s.id} className="stack-card">
                                    <div><strong>Tarih:</strong> {formatDatePart(s.scheduled_start)}</div>
                                    <div><strong>Saat:</strong> {formatTimePart(s.scheduled_start)}</div>
                                    <div><strong>Konu:</strong> {s.topic || "-"}</div>
                                    <div><strong>Süre:</strong> {s.duration_min} dk</div>
                                    <div><strong>Durum:</strong> {s.status}</div>
                                    <div><strong>Öğretmen Notu:</strong> {s.teacher_mark_note || "-"}</div>
                                    <div style={{ marginTop: 8 }}>
                                        <button
                                            disabled={!(!["CANCELLED", "MISSED", "COMPLETED"].includes(s.status)) || !!s.student_marked_at || !(s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION")}
                                            onClick={() => onStudentMark(s.id)}
                                        >
                                            {s.student_marked_at ? "Onaylandı" : "Dersi Onayla"}
                                        </button>
                                        <button
                                            style={{ marginTop: 6 }}
                                            disabled={!(s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION")}
                                            onClick={() => onStudentNoShow(s.id)}
                                        >
                                            Yapılmadı
                                        </button>
                                        <button
                                            style={{ marginTop: 6 }}
                                            disabled={!(!["CANCELLED", "MISSED", "COMPLETED"].includes(s.status) && !s.teacher_marked_at)}
                                            onClick={() => onStudentCancel(s.id)}
                                        >
                                            İptal Et
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="calendar-wrap">
                        <div className="calendar-header">
                            <h3 style={{ margin: 0 }}>Takvim (Ders + Google)</h3>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setMonthOffset((m) => m - 1)}>‹</button>
                                <button onClick={() => setMonthOffset(0)}>Bugün</button>
                                <button onClick={() => setMonthOffset((m) => m + 1)}>›</button>
                            </div>
                        </div>
                        {(() => {
                            const { first, days } = buildMonthDays(monthOffset);
                            const items = mergeCalendarItems();
                            const byDate = new Map();
                            items.forEach((it) => {
                                if (!byDate.has(it.date)) byDate.set(it.date, []);
                                byDate.get(it.date).push(it);
                            });
                            return (
                                <>
                                    <div style={{ marginBottom: 8, color: "#5e5e67" }}>
                                        {first.toLocaleString([], { month: "long", year: "numeric" })}
                                    </div>
                                    <div className="calendar-grid">
                                        {days.map((d, idx) => {
                                            if (!d) return <div key={`e-${idx}`} className="calendar-cell" />;
                                            const key = toKey(d);
                                            const dayItems = byDate.get(key) || [];
                                            return (
                                                <div key={key} className="calendar-cell">
                                                    <div className="calendar-day">{d.getDate()}</div>
                                                    {dayItems.map((it, i) => (
                                                        <span key={`${key}-${i}`} className={`calendar-item ${it.type}`}>
                                                            {it.time} · {it.title}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
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

                    {sessions.some((s) => s.teacher_marked_at) && (
                        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                            <h3 style={{ marginTop: 0 }}>Ders Raporları ({reports.length})</h3>
                            {reports.length === 0 ? (
                                <div>Rapor yok.</div>
                            ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ textAlign: "left" }}>
                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Konu</th>
                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Puan</th>
                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen Notu</th>
                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sonraki Ders Notu</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((r) => (
                                            <tr key={r.id}>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{formatDatePart(r.created_at)}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.topic || "-"}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.performance_rating ?? "-"}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.teacher_note || "-"}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.next_note || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

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

