import React from "react";
import { createBrowserRouter } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AdminPage from "./pages/AdminPage";
import TeacherPage from "./pages/TeacherPage";
import RequireAuth from "./auth/RequireAuth";


export const router = createBrowserRouter([
    { path: "/login", element: <LoginPage /> },

    //Giriş zorunlu
    {
        element: <RequireAuth />,
        children: [
            { path: "/", element: <Dashboard /> },

            //Admin sayfası
            {
                element: <RequireAuth allowedRoles={["ADMIN"]} />,
                children: [{ path: "/admin", element: <AdminPage /> }],
            },
            //Teacher sayfası
            {
                element: <RequireAuth allowedRoles={["TEACHER"]} />,
                children: [{ path: "/teacher", element: <TeacherPage /> }]

            },
        ],
    },

]);
