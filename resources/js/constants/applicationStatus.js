/**
 * 応募ステータスの統一ラベル・色・バッジクラス定義
 * 全ページでこの定義を使うこと
 */

// 求職者向けラベル
export const STATUS_LABELS = {
    pending: '応募済み',
    under_review: '書類選考中',
    interviewing: '面接中',
    offered: '内定',
    rejected: '不採用',
    withdrawn: '辞退',
    hired: '採用',
    accepted: '承諾済み',
};

// 企業向けラベル
export const STATUS_LABELS_COMPANY = {
    pending: '未対応',
    under_review: '書類選考中',
    interviewing: '面接中',
    offered: '内定通知済み',
    rejected: '不採用',
    withdrawn: '辞退',
    hired: '採用決定',
    accepted: '承諾済み',
};

// バッジクラス
export const STATUS_BADGE_CLASS = {
    pending: 'badge-warning',
    under_review: 'badge-info',
    interviewing: 'badge-info',
    offered: 'badge-success',
    rejected: 'badge-error',
    withdrawn: 'badge-error',
    hired: 'badge-success',
    accepted: 'badge-success',
};

// ステータス色
export const STATUS_COLORS = {
    pending: '#f59e0b',
    under_review: '#3b82f6',
    interviewing: '#8b5cf6',
    offered: '#22c55e',
    rejected: '#ef4444',
    withdrawn: '#6b7280',
    hired: '#22c55e',
    accepted: '#22c55e',
};
