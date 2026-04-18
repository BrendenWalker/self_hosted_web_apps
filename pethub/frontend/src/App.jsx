import React from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ReportsPage from './pages/ReportsPage';
import PetsManagePage from './pages/PetsManagePage';
import AdminPage from './pages/AdminPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import './App.css';

function AppShell() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <Outlet />
      </OfflineQueueProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'invite/pet/:token', element: <InviteAcceptPage /> },
      {
        element: (
          <RequireAuth>
            <Layout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'reports/*', element: <ReportsPage /> },
          { path: 'pets', element: <PetsManagePage /> },
          { path: 'admin', element: <AdminPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <div className="app-viewport">
      <RouterProvider router={router} />
    </div>
  );
}
