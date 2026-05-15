<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
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

        // 本番環境ではスタックトレースを隠す
        $exceptions->render(function (Throwable $e, Request $request) {
            if (!$request->is('api/*') && !$request->expectsJson()) {
                return null; // Web: デフォルトのLaravelハンドリング
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
