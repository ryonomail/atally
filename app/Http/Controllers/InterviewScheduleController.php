<?php

namespace App\Http\Controllers;

use App\Models\InterviewSchedule;
use App\Models\Application;
use App\Enums\UserRole;
use Illuminate\Http\Request;

class InterviewScheduleController extends Controller
{
    /**
     * 面接日程一覧
     */
    public function index(Request $request, Application $application)
    {
        $this->authorizeApplication($request, $application);

        $schedules = $application->interviewSchedules()
            ->orderBy('scheduled_at', 'asc')
            ->get();

        return response()->json(['schedules' => $schedules]);
    }

    /**
     * 面接日程作成（企業のみ）
     */
    public function store(Request $request, Application $application)
    {
        $this->authorizeCompanyOwnsApplication($request, $application);

        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'url', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $schedule = InterviewSchedule::create(array_merge($validated, [
            'application_id' => $application->id,
            'status' => 'pending',
        ]));

        return response()->json(['schedule' => $schedule], 201);
    }

    /**
     * 面接日程更新（企業のみ）
     */
    public function update(Request $request, InterviewSchedule $schedule)
    {
        $this->authorizeCompanyOwnsSchedule($request, $schedule);

        $validated = $request->validate([
            'scheduled_at' => ['sometimes', 'date', 'after:now'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'url', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'string', 'in:pending,confirmed,cancelled,completed'],
        ]);

        $schedule->update($validated);

        if (($validated['status'] ?? null) === 'confirmed') {
            $schedule->update(['confirmed' => true]);
        }

        return response()->json(['schedule' => $schedule->fresh()]);
    }

    /**
     * iCalダウンロード（応募者または企業のみ）
     */
    public function exportIcal(Request $request, InterviewSchedule $schedule)
    {
        $this->authorizeSchedule($request, $schedule);

        $app = $schedule->application()->with(['job.company', 'user'])->first();
        $jobTitle = $app?->job?->title ?? '面接';
        $companyName = $app?->job?->company?->company_name ?? '';
        $candidateName = $app?->user?->name ?? '';

        $start = \Carbon\Carbon::parse($schedule->scheduled_at);
        $end = $start->copy()->addHour();
        $location = $this->escapeIcal($schedule->meeting_url ?: ($schedule->location ?: ''));
        $notes = $this->escapeIcal($schedule->notes ?? '');
        $jobTitleEscaped = $this->escapeIcal($jobTitle);
        $companyNameEscaped = $this->escapeIcal($companyName);
        $candidateNameEscaped = $this->escapeIcal($candidateName);

        $description = "求人: {$jobTitleEscaped}\\n会社: {$companyNameEscaped}\\n候補者: {$candidateNameEscaped}" . ($notes ? "\\n備考: {$notes}" : '');

        $uid = "interview-{$schedule->id}@atally";
        $dtStart = $start->format('Ymd\THis');
        $dtEnd = $end->format('Ymd\THis');
        $now = now()->format('Ymd\THis');

        $ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Atally//Interview//JP\r\nBEGIN:VEVENT\r\nUID:{$uid}\r\nDTSTAMP:{$now}\r\nDTSTART:{$dtStart}\r\nDTEND:{$dtEnd}\r\nSUMMARY:面接 - {$jobTitleEscaped}\r\nLOCATION:{$location}\r\nDESCRIPTION:{$description}\r\nEND:VEVENT\r\nEND:VCALENDAR";

        return response($ical, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"interview_{$schedule->id}.ics\"",
        ]);
    }

    /**
     * 面接日程確定（求職者のみ）
     */
    public function confirm(Request $request, InterviewSchedule $schedule)
    {
        $user = $request->user();

        if ($user->role !== UserRole::JobSeeker) {
            abort(403, 'Unauthorized');
        }

        if ($schedule->application->user_id !== $user->id) {
            abort(403, 'Unauthorized');
        }

        $schedule->update([
            'confirmed' => true,
            'status' => 'confirmed',
        ]);

        return response()->json([
            'schedule' => $schedule->fresh(),
            'message' => '面接日程が確定しました。',
        ]);
    }

    // ---------------------------------------------------------------
    // 認可ヘルパー
    // ---------------------------------------------------------------

    /**
     * 応募に対して求職者または企業のどちらかであることを確認
     */
    private function authorizeApplication(Request $request, Application $application): void
    {
        $user = $request->user();

        if ($user->role === UserRole::JobSeeker) {
            if ($application->user_id !== $user->id) {
                abort(403, 'Unauthorized');
            }
        } elseif ($user->role === UserRole::Company) {
            if ($application->job->company_id !== $user->company_id) {
                abort(403, 'Unauthorized');
            }
        } else {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * 企業が応募の求人を所有していることを確認
     */
    private function authorizeCompanyOwnsApplication(Request $request, Application $application): void
    {
        $user = $request->user();

        if ($user->role !== UserRole::Company) {
            abort(403, 'Unauthorized');
        }

        if ($application->job->company_id !== $user->company_id) {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * スケジュールに対して求職者または企業のどちらかであることを確認
     */
    private function authorizeSchedule(Request $request, InterviewSchedule $schedule): void
    {
        $this->authorizeApplication($request, $schedule->application);
    }

    /**
     * 企業がスケジュールの求人を所有していることを確認
     */
    private function authorizeCompanyOwnsSchedule(Request $request, InterviewSchedule $schedule): void
    {
        $this->authorizeCompanyOwnsApplication($request, $schedule->application);
    }

    /**
     * iCalendarのTEXT値をエスケープ
     */
    private function escapeIcal(string $value): string
    {
        // バックスラッシュ → \\
        $value = str_replace('\\', '\\\\', $value);
        // セミコロン → \;
        $value = str_replace(';', '\\;', $value);
        // カンマ → \,
        $value = str_replace(',', '\\,', $value);
        // 改行 → \n（CRLFインジェクション防止）
        $value = str_replace(["\r\n", "\r", "\n"], '\\n', $value);

        return $value;
    }
}
