import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, Navigate, Link, BrowserRouter, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Navbar from './components/Navbar';
import api from './api';

// ── 即時ロード（最初に表示される可能性が高いページ） ──────────────────
import LandingPage   from './pages/LandingPage';
import JobSearchPage from './pages/JobSearchPage';
import JobDetailPage from './pages/JobDetailPage';
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';

// ── 遅延ロード（必要になるまでJSを読み込まない）────────────────────────
// → ユーザーがそのページに遷移したときだけダウンロードされる
const GuestResumeEditorPage  = lazy(() => import('./pages/GuestResumeEditorPage'));
const DashboardPage          = lazy(() => import('./pages/DashboardPage'));
const ProfilePage            = lazy(() => import('./pages/ProfilePage'));
const ResumeListPage         = lazy(() => import('./pages/ResumeListPage'));
const ResumeEditorPage       = lazy(() => import('./pages/ResumeEditorPage'));
const CompanyDashboard       = lazy(() => import('./pages/CompanyDashboard'));
const CompanyJobsPage        = lazy(() => import('./pages/CompanyJobsPage'));
const ScoutSearchPage        = lazy(() => import('./pages/ScoutSearchPage'));
const AgencyJobDBPage        = lazy(() => import('./pages/AgencyJobDBPage'));
const AgencyBulkUploadPage   = lazy(() => import('./pages/AgencyBulkUploadPage'));
const AgencyClientsPage      = lazy(() => import('./pages/AgencyClientsPage'));
const AgencyDashboardPage    = lazy(() => import('./pages/AgencyDashboardPage'));
const CompanyApplicationsPage = lazy(() => import('./pages/CompanyApplicationsPage'));
const AdminDashboard         = lazy(() => import('./pages/AdminDashboard'));
const MyApplicationsPage     = lazy(() => import('./pages/MyApplicationsPage'));
const MessagesListPage       = lazy(() => import('./pages/MessagesListPage'));
const TermsPage              = lazy(() => import('./pages/TermsPage'));
const PrivacyPolicyPage      = lazy(() => import('./pages/PrivacyPolicyPage'));
const ForgotPasswordPage     = lazy(() => import('./pages/ForgotPasswordPage'));
const VerifyEmailPage        = lazy(() => import('./pages/VerifyEmailPage'));
const SettingsPage           = lazy(() => import('./pages/SettingsPage'));
const SavedJobsPage          = lazy(() => import('./pages/SavedJobsPage'));
const JobAlertsPage          = lazy(() => import('./pages/JobAlertsPage'));
const NotificationsPage      = lazy(() => import('./pages/NotificationsPage'));
const NotFoundPage           = lazy(() => import('./pages/NotFoundPage'));
const ForbiddenPage          = lazy(() => import('./pages/ForbiddenPage'));
const HelpPage               = lazy(() => import('./pages/HelpPage'));
const PricingPage            = lazy(() => import('./pages/PricingPage'));
const ForCompaniesPage       = lazy(() => import('./pages/ForCompaniesPage'));
const ForAgenciesPage        = lazy(() => import('./pages/ForAgenciesPage'));
const AboutPage              = lazy(() => import('./pages/AboutPage'));
const CompanyProfilePage     = lazy(() => import('./pages/CompanyProfilePage'));
const OnboardingModal        = lazy(() => import('./components/OnboardingModal'));

// ページ遷移中のフォールバック（スピナー）
function PageFallback() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
    );
}

function ProtectedRoute({ children, role }) {
    const { user, loading } = useAuth();

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 200 }} /></div>;
    if (!user) return <Navigate to="/login" />;
    if (role && user.role !== role) return <Navigate to="/" />;

    return children;
}

function getHomePath(user) {
    if (!user) return '/jobs';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'company') return '/company';
    return '/jobs';
}

/* ============================================
   モバイルボトムナビ（求職者用）
   ============================================ */
function MobileBottomNav() {
    const { user } = useAuth();
    const path = window.location.pathname;
    if (!user || user.role !== 'jobseeker') return null;

    const tabs = [
        { to: '/jobs', icon: '🔍', label: '求人' },
        { to: '/applications', icon: '📨', label: '応募' },
        { to: '/dashboard', icon: '🏠', label: 'ホーム' },
        { to: '/messages', icon: '💬', label: 'メッセージ' },
        { to: '/profile', icon: '👤', label: 'マイページ' },
    ];

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            display: 'none',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--color-border)',
            paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="mobile-bottom-nav">
            {tabs.map(tab => {
                const active = path === tab.to || path.startsWith(tab.to + '/');
                return (
                    <Link key={tab.to} to={tab.to} style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '8px 0', textDecoration: 'none',
                        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        fontSize: 'var(--font-size-xs)', fontWeight: active ? 600 : 400,
                        transition: 'color 0.15s',
                        gap: 2,
                    }}>
                        <span style={{ fontSize: active ? '1.3rem' : '1.1rem', transition: 'font-size 0.15s', lineHeight: 1 }}>
                            {tab.icon}
                        </span>
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}

/* ============================================
   オフライン検知バナー
   ============================================ */
function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#1d1d1f',
            color: '#fff',
            textAlign: 'center',
            padding: '10px var(--space-md)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
            <span style={{ fontSize: 16 }}>📡</span>
            インターネット接続が切れています。一部の機能が利用できない場合があります。
        </div>
    );
}

function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
}

function AppRoutes() {
    const { user } = useAuth();
    const homePath = getHomePath(user);

    // アプリ起動直後に求人1ページ目を先読み（ユーザーが/jobsに遷移する前にデータ取得開始）
    useEffect(() => {
        api.get('/jobs', { params: { page: 1, per_page: 20, sort: 'ranking' } }).catch(() => {});
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <ScrollToTop />
            <OfflineBanner />
            <Navbar />
            <Suspense fallback={null}><MobileBottomNav /></Suspense>
            <Suspense fallback={null}><OnboardingModal /></Suspense>
            <div style={{ flex: 1 }}>
            <Suspense fallback={<PageFallback />}>
            <Routes>
                <Route path="/" element={user ? <Navigate to={homePath} /> : <LandingPage />} />
                <Route path="/resumes/guest" element={<GuestResumeEditorPage />} />
                <Route path="/login" element={user ? <Navigate to={homePath} /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to={homePath} /> : <RegisterPage />} />
                <Route path="/forgot-password" element={user ? <Navigate to={homePath} /> : <ForgotPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/jobs" element={<JobSearchPage />} />
                <Route path="/jobs/:id" element={<JobDetailPage />} />
                <Route path="/companies/:id" element={<CompanyProfilePage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/for-companies" element={<ForCompaniesPage />} />
                <Route path="/for-agencies" element={<ForAgenciesPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/403" element={<ForbiddenPage />} />

                {/* 共通（全認証ユーザー） */}
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

                {/* 求職者 */}
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute role="jobseeker"><ProfilePage /></ProtectedRoute>} />
                <Route path="/resumes" element={<ProtectedRoute role="jobseeker"><ResumeListPage /></ProtectedRoute>} />
                <Route path="/resumes/:id" element={<ProtectedRoute role="jobseeker"><ResumeEditorPage /></ProtectedRoute>} />
                <Route path="/applications" element={<ProtectedRoute role="jobseeker"><MyApplicationsPage /></ProtectedRoute>} />
                <Route path="/saved-jobs" element={<ProtectedRoute role="jobseeker"><SavedJobsPage /></ProtectedRoute>} />
                <Route path="/job-alerts" element={<ProtectedRoute role="jobseeker"><JobAlertsPage /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><MessagesListPage /></ProtectedRoute>} />
                <Route path="/messages/:applicationId" element={<ProtectedRoute><MessagesListPage /></ProtectedRoute>} />

                {/* 企業 */}
                <Route path="/company" element={<ProtectedRoute role="company"><CompanyDashboard /></ProtectedRoute>} />
                <Route path="/company/jobs" element={<ProtectedRoute role="company"><CompanyJobsPage /></ProtectedRoute>} />
                <Route path="/company/scout" element={<ProtectedRoute role="company"><ScoutSearchPage /></ProtectedRoute>} />
                <Route path="/company/bulk-upload" element={<ProtectedRoute role="company"><AgencyBulkUploadPage /></ProtectedRoute>} />
                <Route path="/company/jobs/:jobId/applications" element={<ProtectedRoute role="company"><CompanyApplicationsPage /></ProtectedRoute>} />

                {/* /agency/* → /company へリダイレクト */}
                <Route path="/agency" element={<Navigate to="/company" replace />} />
                <Route path="/agency/*" element={<Navigate to="/company" replace />} />

                {/* 運営管理 */}
                <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
            </div>
            <footer style={{
                borderTop: '1px solid var(--color-border)',
                padding: 'var(--space-2xl) 0 var(--space-lg)',
                background: 'var(--color-bg-surface)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
            }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>Atally</div>
                            <p style={{ lineHeight: 1.8, margin: 0 }}>ぴったり合う仕事探し、はじめよう。</p>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>求職者の方</div>
                            {[
                                { to: '/jobs', label: '求人を探す' },
                                { to: '/register', label: '無料登録' },
                                { to: '/resumes/guest', label: '履歴書作成（無料）' },
                            ].map(l => (
                                <div key={l.to} style={{ marginBottom: 6 }}>
                                    <Link to={l.to} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>{l.label}</Link>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>企業の方</div>
                            {[
                                { to: '/for-companies', label: '採用担当者へ' },
                                { to: '/pricing', label: '料金プラン' },
                                { to: '/register?role=company', label: '企業登録' },
                            ].map(l => (
                                <div key={l.to} style={{ marginBottom: 6 }}>
                                    <Link to={l.to} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>{l.label}</Link>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>人材紹介会社の方</div>
                            {[
                                { to: '/for-agencies', label: '紹介会社向けサービス' },
                                { to: '/pricing', label: '料金プラン' },
                                { to: '/register?role=company', label: '紹介会社登録' },
                            ].map(l => (
                                <div key={l.to} style={{ marginBottom: 6 }}>
                                    <Link to={l.to} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>{l.label}</Link>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>サポート</div>
                            {[
                                { to: '/help', label: 'ヘルプセンター' },
                                { to: '/about', label: 'Atallyについて' },
                                { to: '/terms', label: '利用規約' },
                                { to: '/privacy', label: 'プライバシーポリシー' },
                            ].map(l => (
                                <div key={l.to} style={{ marginBottom: 6 }}>
                                    <Link to={l.to} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>{l.label}</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                        <span>&copy; {new Date().getFullYear()} Atally. All rights reserved.</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.25)', color: '#1d8f42' }}>
                            ⚖️ 職業安定法準拠
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default function App() {
    return (
        <HelmetProvider>
            <AuthProvider>
                <ToastProvider>
                    <BrowserRouter>
                        <AppRoutes />
                    </BrowserRouter>
                </ToastProvider>
            </AuthProvider>
        </HelmetProvider>
    );
}

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
