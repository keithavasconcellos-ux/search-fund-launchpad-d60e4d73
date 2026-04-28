import { Navigate, useLocation } from 'react-router-dom';

export const AUTH_KEY = 'acquira_auth';

export function isAuthed() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function signOut() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
  } catch {
    /* noop */
  }
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
