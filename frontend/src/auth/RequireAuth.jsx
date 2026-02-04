import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { loadAuth } from "./authStore";

export default function RequireAuth({ allowedRoles }) {
    const location = useLocation();
    const { token, user } = loadAuth();

    if (!token) {
        return <Navigate to="/login" replace_state={{ from: location }} />
    }
    if (allowedRoles?.length) {
        const role = user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return <Navigate to="/" replace />
        }
    }
    return <Outlet />
}
