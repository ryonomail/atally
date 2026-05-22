<?php

namespace App\Http\Controllers;

use App\Models\InterviewSchedule;
use App\Models\Application;
use Illuminate\Http\Request;

class InterviewScheduleController extends Controller
{
    public function index(Request $request, Application $application)
    {
        $this->authorize('view', $application);

        $schedules = $application->interviewSchedules()
            ->orderBy('scheduled_at', 'asc')
            ->get();

        return response()->json(['schedules' => $schedules]);
    }

    public function store(Request $request, Application $application)
    {
        $this->authorize('updateStatus', $application);

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

    public function update(Request $request, InterviewSchedule $schedule)
    {
        $this->authorize('manage', $schedule);

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

    public function exportIcal(Request $request, InterviewSchedule $schedule)
    {
        $this->authorize('view', $schedule);

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

    public function confirm(Request $request, InterviewSchedule $schedule)
    {
        $this->authorize('view', $schedule);

        if (!$request->user()->isJobSeeker()) {
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

    private function escapeIcal(string $value): string
    {
        $value = str_replace('\\', '\\\\', $value);
        $value = str_replace(';', '\\;', $value);
        $value = str_replace(',', '\\,', $value);
        $value = str_replace(["\r\n", "\r", "\n"], '\\n', $value);

        return $value;
    }
}
