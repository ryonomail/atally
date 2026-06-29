import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard } from 'lucide-react';
import api from '../api';
import { useToast } from '../hooks/useToast';

// サーバーが app.blade.php で window.__STRIPE_KEY__ に公開キーを注入する
const stripePromise = window.__STRIPE_KEY__ ? loadStripe(window.__STRIPE_KEY__) : null;

/* カード登録フォーム（Stripe Elements） */
function CardRegistrationForm({ onCardRegistered }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cardholderName, setCardholderName] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        if (!cardholderName.trim()) { setError('カード名義人を入力してください。'); return; }
        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/payment/setup-intent');
            const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(data.client_secret, {
                payment_method: {
                    card: elements.getElement(CardElement),
                    billing_details: { name: cardholderName.trim() },
                },
            });
            if (stripeError) { setError(stripeError.message); return; }
            await api.post('/payment/confirm-card', { payment_method_id: setupIntent.payment_method });
            onCardRegistered();
        } catch (err) {
            setError(err.response?.data?.message || 'カード登録に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                    カード名義人（半角ローマ字 / 例: TARO YAMADA）
                </label>
                <input
                    type="text"
                    className="form-input"
                    value={cardholderName}
                    onChange={e => setCardholderName(e.target.value)}
                    placeholder="TARO YAMADA"
                    autoComplete="cc-name"
                />
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    アカウント名と異なる名義のカードでも登録できます。カード券面どおりに入力してください。
                </p>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: '#fff' }}>
                <CardElement options={{ style: { base: { fontSize: '16px', color: '#333', '::placeholder': { color: '#aab7c4' } }, invalid: { color: '#e74c3c' } }, hidePostalCode: true }} />
            </div>
            {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={!stripe || loading}>
                {loading ? '登録中...' : 'カードを登録する'}
            </button>
        </form>
    );
}

/* カード情報セクション（登録/変更/削除）。企業・人材紹介の両ダッシュボードで共用。 */
export default function PaymentCardSection() {
    const toast = useToast();
    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchCard = async () => {
        setLoading(true);
        try { const { data } = await api.get('/payment/method'); setCard(data.card); }
        catch { setCard(null); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchCard(); }, []);

    const handleDelete = async (skipConfirm = false) => {
        if (!skipConfirm && !confirm('登録済みカードを削除しますか？')) return false;
        setDeleting(true);
        try { await api.delete('/payment/method'); setCard(null); return true; }
        catch { toast.error('カード削除に失敗しました'); return false; }
        finally { setDeleting(false); }
    };

    const handleCardRegistered = () => { setShowForm(false); fetchCard(); };

    if (loading) return <div className="skeleton" style={{ height: 60 }} />;

    return (
        <div>
            {card ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <CreditCard size={22} strokeWidth={2} style={{ color: 'var(--color-text-accent)' }} />
                        <div>
                            <p style={{ fontWeight: 600 }}>{card.brand?.toUpperCase()} **** {card.last4}</p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>有効期限: {card.exp_month}/{card.exp_year}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                            onClick={async () => { const ok = await handleDelete(true); if (ok) setShowForm(true); }}>カード変更</button>
                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}
                            onClick={handleDelete} disabled={deleting}>{deleting ? '削除中...' : '削除'}</button>
                    </div>
                </div>
            ) : (
                !showForm ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                            クレジットカードが登録されていません。求人をブースト（上位表示）するにはカード登録が必要です。
                        </p>
                        <button className="btn btn-primary" onClick={() => setShowForm(true)}>カードを登録する</button>
                    </div>
                ) : (
                    stripePromise ? (
                        <Elements stripe={stripePromise}>
                            <CardRegistrationForm onCardRegistered={handleCardRegistered} />
                        </Elements>
                    ) : (
                        <div style={{ padding: 'var(--space-md)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                            <strong style={{ color: '#d97706' }}>決済の準備中です</strong><br />
                            しばらくしてから再度お試しください。
                        </div>
                    )
                )
            )}
        </div>
    );
}
