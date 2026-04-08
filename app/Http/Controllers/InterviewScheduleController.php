<?php

namespace App\Http\Controllers;

use App\Models\InterviewSchedule;
use App\Models\Application;
use Illuminate\Http\Request;

class InterviewScheduleController extends Controller
{
    /**
     * 面接日程一覧
     */
    public function index(Request $request, Application $application)
    {
        $schedules = $application->interviewSchedules()
            ->orderBy('scheduled_at', 'asc')
            ->get();

        return response()->json(['schedules' => $schedules]);
    }

    /**
     * 面接日程作成
     */
    public function store(Request $request, Application $application)
    {
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
     * 面接日程更新
     */
    public function update(Request $request, InterviewSchedule $schedule)
    {
        $validated = $request->validate([
            'scheduled_at' => ['sometimes', 'date', 'after:now'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'url', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'string', 'in:pending,confirmed,cancelled,completed'],
        ]);

        $schedule->update($validated);

        // status が confirmed の場合は confirmed フラグも同期
        if (($validated['status'] ?? null) === 'confirmed') {
            $schedule->update(['confirmed' => true]);
        }

        return response()->json(['schedule' => $schedule->fresh()]);
    }

    /**
     * iCalダウンロード
     */
    public function exportIcal(InterviewSchedule $schedule)
    {
        $app = $schedule->application()->with(['job.company', 'user'])->first();
        $jobTitle = $app?->job?->title ?? '面接';
        $companyName = $app?->job?->company?->company_name ?? '';
        $candidateName = $app?->user?->name ?? '';

        $start = \Carbon\Carbon::parse($schedule->scheduled_at);
        $end = $start->copy()->addHour();
        $location = $schedule->meeting_url ?: ($schedule->location ?: '');
        $description = "求人: {$jobTitle}\\n会社: {$companyName}\\n候補者: {$candidateName}" . ($schedule->notes ? "\\n備考: {$schedule->notes}" : '');

        $uid = "interview-{$schedule->id}@atally";
        $dtStart = $start->format('Ymd\THis');
        $dtEnd = $end->format('Ymd\THis');
        $now = now()->format('Ymd\THis');

        $ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Atally//Interview//JP\r\nBEGIN:VEVENT\r\nUID:{$uid}\r\nDTSTAMP:{$now}\r\nDTSTART:{$dtStart}\r\nDTEND:{$dtEnd}\r\nSUMMARY:面接 - {$jobTitle}\r\nLOCATION:{$location}\r\nDESCRIPTION:{$description}\r\nEND:VEVENT\r\nEND:VCALENDAR";

        return response($ical, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"interview_{$schedule->id}.ics\"",
        ]);
    }

    /**
     * 面接日程確定（求職者用）
     */
    public function confirm(Request $request, InterviewSchedule $schedule)
    {
        $schedule->update([
            'confirmed' => true,
            'status' => 'confirmed',
        ]);

        return response()->json([
            'schedule' => $schedule->fresh(),
            'message' => '面接日程が確定しました。',
        ]);
    }
}
