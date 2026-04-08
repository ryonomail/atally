import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to track unsaved changes and prompt the user before navigating away.
 * @param {object} initialForm - The initial form data (from server).
 * @param {object} currentForm - The current form data (user edits).
 * @returns {{ isDirty, confirmNavigation }}
 */
export function useUnsavedChanges(initialForm, currentForm) {
    const [isDirty, setIsDirty] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!initialForm) {
            setIsDirty(false);
            return;
        }
        const dirty = JSON.stringify(initialForm) !== JSON.stringify(currentForm);
        setIsDirty(dirty);
    }, [initialForm, currentForm]);

    // Warn on browser back / tab close
    useEffect(() => {
        const handler = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const confirmNavigation = useCallback((to) => {
        if (isDirty) {
            if (window.confirm('保存されていない変更があります。このページを離れますか？')) {
                navigate(to);
            }
        } else {
            navigate(to);
        }
    }, [isDirty, navigate]);

    return { isDirty, confirmNavigation };
}
