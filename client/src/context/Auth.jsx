import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api.js';
import { nouns } from '../lib/labels.js';

const AuthCtx = createContext(null);

const DEFAULT_SETTINGS = {
  warning_missed_threshold: 2,
  warning_inactive_days: 14,
  exam_pass_grade: 60,
  work_start: '06:00',
  work_end: '22:00',
  recitation_minutes: 30,
  exam_minutes: 45,
  juz_pages: 20,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    try {
      const d = await api.get('/settings');
      setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
    } catch {
      /* الإعدادات الافتراضية */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadSettings();
  }, [user?.id, loadSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // لون الواجهة يتغير حسب نوع المستخدم
  useEffect(() => {
    document.documentElement.dataset.theme = user ? (user.role === 'admin' ? 'admin' : user.supervisor_type) : 'admin';
  }, [user]);

  const login = useCallback(async (username, password) => {
    const d = await api.post('/auth/login', { username, password });
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const d = await api.get('/auth/me');
    setUser(d.user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      settings,
      reloadSettings: loadSettings,
      login,
      logout,
      refreshUser,
      isAdmin: user?.role === 'admin',
      isSupervisor: user?.role === 'supervisor',
      n: nouns(user?.role === 'supervisor' ? user.supervisor_type : null),
    }),
    [user, loading, settings, loadSettings, login, logout, refreshUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
