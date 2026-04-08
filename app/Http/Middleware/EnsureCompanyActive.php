<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureCompanyActive
{
    public function handle(Request $request, Closure $next)
    {
        $company = $request->user()?->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が登録されていません。'], 403);
        }

        if ($company->status->value === 'suspended') {
            return response()->json(['message' => 'アカウントが停止されています。'], 403);
        }

        return $next($request);
    }
}
