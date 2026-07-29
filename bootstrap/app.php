<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // リバースプロキシ（Caddy/Cloudflare/Render等）背後で実クライアントIPを正しく取得する。
        // appコンテナはホスト非公開で、前段プロキシ経由でのみ到達するため '*' を信頼してよい。
        // これがないと全リクエストがプロキシIPに見え、レート制限/BAN判定が誤爆する。
        $middleware->trustProxies(at: '*', headers:
            Request::HEADER_X_FORWARDED_FOR |
            Request::HEADER_X_FORWARDED_HOST |
            Request::HEADER_X_FORWARDED_PORT |
            Request::HEADER_X_FORWARDED_PROTO
        );

        // グローバルミドルウェア: セキュリティヘッダー
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'verified.company' => \App\Http\Middleware\EnsureCompanyVerified::class,
            'active.company' => \App\Http\Middleware\EnsureCompanyActive::class,
            'block.bots' => \App\Http\Middleware\BlockSuspiciousRequests::class,
            'check.suspended' => \App\Http\Middleware\CheckSuspended::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Sentry: SENTRY_LARAVEL_DSN が設定されている場合のみ有効
        if (class_exists(\Sentry\Laravel\Integration::class)) {
            \Sentry\Laravel\Integration::handles($exceptions);
        }

        // API リクエストには常にJSONレスポンスを返す
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // 500系の想定外エラーは即アラート（Web/API問わず）。
        // 「エラーが出続けているのに気づかない」状態を防ぐ。同一エラーは30分に1回に抑制。
        $exceptions->report(function (Throwable $e) {
            $ignored = [
                AuthenticationException::class,
                ValidationException::class,
                NotFoundHttpException::class,
                \Illuminate\Auth\Access\AuthorizationException::class,
                \Illuminate\Session\TokenMismatchException::class,
                \Illuminate\Database\Eloquent\ModelNotFoundException::class,
                \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException::class,
                \Illuminate\Http\Exceptions\ThrottleRequestsException::class,
            ];
            foreach ($ignored as $class) {
                if ($e instanceof $class) return;
            }
            // 4xxのHttpExceptionはユーザー起因なので通知しない（5xxのみ）
            if ($e instanceof HttpException && $e->getStatusCode() < 500) return;

            \App\Support\ErrorAlert::notify($e, request()->path(), request()->method());
        });

        // 本番環境ではスタックトレースを隠す
        $exceptions->render(function (Throwable $e, Request $request) {
            if (!$request->is('api/*') && !$request->expectsJson()) {
                return null; // Web: デフォルトのLaravelハンドリング
            }

            // 未認証: SPA構成で 'login' 名前付きルートが無いため、
            // これを先に処理しないと Laravel がリダイレクト先を解決できず 500 になる（履歴書APIが落ちていた原因）
            if ($e instanceof AuthenticationException) {
                return response()->json(['message' => 'ログインが必要です。'], 401);
            }

            if ($e instanceof ValidationException) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], 422);
            }

            if ($e instanceof NotFoundHttpException) {
                return response()->json(['message' => 'リソースが見つかりません。'], 404);
            }

            if ($e instanceof HttpException) {
                return response()->json([
                    'message' => $e->getMessage() ?: 'エラーが発生しました。',
                ], $e->getStatusCode());
            }

            // 本番: 詳細を隠す / 開発: 詳細を表示
            if (app()->isProduction()) {
                return response()->json([
                    'message' => 'サーバーエラーが発生しました。しばらくしてから再度お試しください。',
                ], 500);
            }

            return null;
        });
    })->create();
