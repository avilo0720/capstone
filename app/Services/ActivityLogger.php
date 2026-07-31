<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogger
{
    public function log(
        Request $request,
        string $action,
        string $description,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $meta = null,
    ): void {
        $sessionUser = $request->session()->get('user');

        ActivityLog::create([
            'user_id' => $sessionUser['id'] ?? null,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'description' => $description,
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }
}
