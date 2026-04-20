<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Application;
use App\Models\InAppNotification;
use App\Enums\CompanyStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MessageController extends Controller
{
    /**
     * メッセージ一覧取得
     */
    public function index(Request $request, Application $application)
    {
        $this->authorizeChat($request, $application);

        $messages = $application->messages()
            ->with('sender:id,name')
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        // 未読を既読に
        $application->messages()
            ->where('sender_id', '!=', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json($messages);
    }

    /**
     * メッセージ送信
     */
    public function store(Request $request, Application $application)
    {
        $this->authorizeChat($request, $application);

        // スカウト経由: 承認前は企業側入力無効
        if ($application->isScout() && !$application->isAccepted()) {
            $companyUser = $application->job->company->user;
            if ($request->user()->id === $companyUser->id) {
                return response()->json([
                    'message' => '求職者がスカウトを承認するまでメッセージは送信できません。',
                ], 403);
            }
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,doc,docx,jpg,jpeg,png'],
        ]);

        $data = [
            'application_id' => $application->id,
            'sender_id' => $request->user()->id,
            'body' => strip_tags($validated['body']),
        ];

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $data['attachment_path'] = $file->store('message_attachments', 'public');
            $data['attachment_name'] = $file->getClientOriginalName();
        }

        $message = Message::create($data);

        // 相手方にメッセージ通知メール + アプリ内通知
        $sender = $request->user();
        $applicant = $application->user;
        $companyUser = $application->job->company->user;
        $recipient = $sender->id === $applicant->id ? $companyUser : $applicant;
        if ($recipient) {
            $recipient->notify(new \App\Notifications\NewMessageNotification($message));
            InAppNotification::notify(
                $recipient->id,
                'message',
                '新しいメッセージがあります',
                mb_substr($validated['body'], 0, 80),
                "/messages/{$application->id}"
            );
        }

        return response()->json([
            'message' => $message->load('sender:id,name'),
        ], 201);
    }

    /**
     * 会話一覧（メッセージのあるアプリケーション）
     */
    public function conversations(Request $request)
    {
        $userId = $request->user()->id;

        $applications = Application::where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->orWhereHas('job.company', function ($q2) use ($userId) {
                        $q2->whereHas('user', fn($q3) => $q3->where('id', $userId));
                    });
            })
            ->whereHas('messages')
            ->with(['job:id,title,company_id', 'job.company:id,company_name', 'user:id,name'])
            ->withCount(['messages as unread_count' => function ($q) use ($userId) {
                $q->where('sender_id', '!=', $userId)->whereNull('read_at');
            }])
            ->addSelect(['*',
                \DB::raw('(SELECT MAX(created_at) FROM messages WHERE messages.application_id = applications.id) as last_message_at'),
            ])
            ->orderByDesc('last_message_at')
            ->get()
            ->map(function ($app) use ($userId) {
                $lastMsg = $app->messages()->latest()->first();
                return [
                    'application_id' => $app->id,
                    'job_title' => $app->job->title ?? '求人情報',
                    'company_name' => $app->job->company->company_name ?? '企業',
                    'applicant_name' => $app->user->name ?? '求職者',
                    'type' => $app->type,
                    'status' => $app->status,
                    'unread_count' => $app->unread_count,
                    'last_message' => $lastMsg ? [
                        'body' => mb_substr($lastMsg->body, 0, 80),
                        'sender_name' => $lastMsg->sender_id === $userId ? 'あなた' : ($lastMsg->sender->name ?? ''),
                        'created_at' => $lastMsg->created_at,
                        'has_attachment' => (bool) $lastMsg->attachment_name,
                    ] : null,
                ];
            });

        return response()->json($applications);
    }

    /**
     * 未読メッセージ数
     */
    public function unreadCount(Request $request)
    {
        $userId = $request->user()->id;

        // 自分が参加しているアプリケーションの未読数
        $count = Message::whereHas('application', function ($q) use ($userId) {
            $q->where('user_id', $userId)
                ->orWhereHas('job.company', function ($q2) use ($userId) {
                $q2->whereHas('user', function ($q3) use ($userId) {
                            $q3->where('id', $userId);
                        }
                        );
                    }
                    );
                })
            ->where('sender_id', '!=', $userId)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * 添付ファイルダウンロード
     */
    public function downloadAttachment(Request $request, Message $message)
    {
        $application = $message->application;
        $this->authorizeChat($request, $application);

        if (!$message->attachment_path) {
            abort(404, '添付ファイルがありません。');
        }

        // パストラバーサル対策: 添付ファイルが許可ディレクトリ内にあることを確認
        $disk = Storage::disk('public');
        $allowedBase = realpath($disk->path('message_attachments'));
        $filePath    = realpath($disk->path($message->attachment_path));

        if (!$filePath || !$allowedBase || !str_starts_with($filePath, $allowedBase . DIRECTORY_SEPARATOR)) {
            abort(403, '不正なファイルパスです。');
        }

        return $disk->download(
            $message->attachment_path,
            $message->attachment_name
        );
    }

    private function authorizeChat(Request $request, Application $application): void
    {
        $user = $request->user();

        // 求職者チェック
        if ($application->user_id === $user->id) {
            return;
        }

        // 企業チェック
        $company = $user->company;
        if ($company && $application->job->company_id === $company->id) {
            // Phase2ペナルティ: チャットアクセス剥奪
            if ($company->isSuspended()) {
                abort(403, '未払いによりチャットへのアクセスが停止されています。');
            }
            return;
        }

        abort(403);
    }
}
