import api from '../api';

// CTAクリック計測（fire-and-forget）。失敗してもUXに影響させない。
// event: apply_open / quick_apply / guest_resume_start / login_to_apply / save / phone_tap
export function trackCta(event, jobId = null, source = null) {
    try {
        api.post('/events/cta', { event, job_id: jobId ?? undefined, source: source ?? undefined }).catch(() => {});
    } catch { /* no-op */ }
}
