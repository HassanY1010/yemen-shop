<?php

use App\Http\Controllers\Shared\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json([
    'status' => 'ok',
    'version' => '1.0.0-laravel',
    'timestamp' => now()->toISOString(),
]));

Route::get('init-db', fn () => response()->json([
    'status' => 'ok',
    'message' => 'Laravel migrations and seeders handle database initialization. Run php artisan migrate:fresh --seed.',
]));

Route::post('webhooks/stripe', function (Request $request) {
    return response()->json([
        'received' => true,
        'type' => $request->input('type'),
    ]);
});

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

Route::post('internal/query', function (Illuminate\Http\Request $request) {
    $sql = $request->input('sql');
    $params = $request->input('params', []);
    $first = $request->input('first', false);
    $run = $request->input('run', false);

    // Simple SQLite to PostgreSQL query translator
    // Generic SQLite to PostgreSQL strftime translator
    $sql = preg_replace_callback('/strftime\(\s*\'([^\']+)\'\s*,\s*([\w\.]+)\s*\)/i', function($matches) {
        $format = $matches[1];
        $column = $matches[2];
        $pgFormat = str_replace(
            ['%Y', '%m', '%d', '%H', '%M', '%S', '%w'],
            ['YYYY', 'MM', 'DD', 'HH24', 'MI', 'SS', 'D'],
            $format
        );
        return "to_char($column, '$pgFormat')";
    }, $sql);
    $sql = preg_replace('/datetime\(\s*\'now\'\s*,\s*\'([^\']+)\'\s*\)/i', "CURRENT_TIMESTAMP + INTERVAL '$1'", $sql);
    $sql = preg_replace('/datetime\(\s*\'now\'\s*\)/i', 'CURRENT_TIMESTAMP', $sql);
    $sql = preg_replace('/date\(\s*\'now\'\s*,\s*\'([^\']+)\'\s*\)/i', "CURRENT_DATE + INTERVAL '$1'", $sql);
    $sql = preg_replace('/date\(\s*\'now\'\s*\)/i', 'CURRENT_DATE', $sql);
    $sql = preg_replace('/INSERT OR IGNORE/i', 'INSERT', $sql);

    // Translate SQLite integer booleans (1/0) to PostgreSQL booleans (true/false)
    $booleanColumns = ['is_primary', 'is_active', 'featured', 'manage_stock'];
    foreach ($booleanColumns as $col) {
        $sql = preg_replace('/([\w\.]+)\.' . $col . '\s*=\s*1\b/i', "$1.$col = true", $sql);
        $sql = preg_replace('/\b' . $col . '\s*=\s*1\b/i', "$col = true", $sql);
        $sql = preg_replace('/([\w\.]+)\.' . $col . '\s*=\s*0\b/i', "$1.$col = false", $sql);
        $sql = preg_replace('/\b' . $col . '\s*=\s*0\b/i', "$col = false", $sql);
    }

    // Fix PostgreSQL Group By issue for non-aggregated columns and GROUP_CONCAT
    $sql = preg_replace('/GROUP_CONCAT\s*\(\s*([^\)]+)\s*\)/i', 'STRING_AGG($1, \',\')', $sql);
    if (stripos($sql, 'group by') !== false) {
        $sql = preg_replace('/(?<!\bMAX\()pi\.url\s+as\s+image\b/i', 'MAX(pi.url) as image', $sql);
    }

    

    try {
        if ($run) {
            $affected = Illuminate\Support\Facades\DB::affectingStatement($sql, $params);
            $lastId = 0;
            try {
                $lastId = (int) Illuminate\Support\Facades\DB::getPdo()->lastInsertId();
            } catch (\Throwable $e) {
                $lastId = 0;
            }
            return response()->json([
                'success' => true,
                'affected' => $affected,
                'meta' => [
                    'last_row_id' => $lastId,
                    'changes' => $affected
                ]
            ]);
        }
        
        $results = Illuminate\Support\Facades\DB::select($sql, $params);
        
        if ($first) {
            return response()->json($results[0] ?? null);
        }
        
        return response()->json(['results' => $results]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage(), 'sql' => $sql], 500);
    }
});