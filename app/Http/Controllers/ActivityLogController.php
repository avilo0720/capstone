<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Support\RolePermissions;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    private const ACTIONS = [
        'created',
        'updated',
        'deleted',
        'stock_added',
        'stock_used',
    ];

    public function index(Request $request): JsonResponse
    {
        $sessionUser = $request->session()->get('user');

        if (!RolePermissions::canViewActivityLogs($sessionUser)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'action' => ['nullable', 'string', Rule::in(self::ACTIONS)],
            'q' => ['nullable', 'string', 'max:120'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $query = ActivityLog::query()
            ->with('user:id,first_name,last_name,username,role')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $date = $validated['date'] ?? null;
        $dateFrom = $validated['date_from'] ?? null;
        $dateTo = $validated['date_to'] ?? null;

        if ($date) {
            $day = Carbon::createFromFormat('Y-m-d', $date)->startOfDay();
            $query->whereBetween('created_at', [
                $day->copy()->startOfDay(),
                $day->copy()->endOfDay(),
            ]);
        } else {
            if ($dateFrom) {
                $query->where(
                    'created_at',
                    '>=',
                    Carbon::createFromFormat('Y-m-d', $dateFrom)->startOfDay()
                );
            }
            if ($dateTo) {
                $query->where(
                    'created_at',
                    '<=',
                    Carbon::createFromFormat('Y-m-d', $dateTo)->endOfDay()
                );
            }
        }

        if (!empty($validated['action'])) {
            $query->where('action', $validated['action']);
        }

        if (!empty($validated['user_id'])) {
            $query->where('user_id', (int) $validated['user_id']);
        }

        if (!empty($validated['q'])) {
            $term = trim($validated['q']);
            $query->where(function ($q) use ($term) {
                $like = '%'.$term.'%';
                $q->where('description', 'like', $like)
                    ->orWhere('action', 'like', $like)
                    ->orWhere('entity_type', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('username', 'like', $like)
                            ->orWhere('role', 'like', $like)
                            ->orWhereRaw(
                                "CONCAT(first_name, ' ', last_name) LIKE ?",
                                [$like]
                            );
                    });
            });
        }

        $wantsPagination = $request->filled('page') || $request->filled('per_page');

        if ($wantsPagination) {
            $perPage = (int) ($validated['per_page'] ?? 25);
            $paginator = $query->paginate($perPage);

            $logs = collect($paginator->items())->map(fn (ActivityLog $log) => $this->serialize($log));

            return response()->json([
                'logs' => $logs,
                'total' => $paginator->total(),
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'actions' => self::ACTIONS,
            ]);
        }

        $limit = (int) ($validated['limit'] ?? ($date ? 200 : 50));
        $logs = $query
            ->limit($limit)
            ->get()
            ->map(fn (ActivityLog $log) => $this->serialize($log));

        return response()->json([
            'date' => $date,
            'count' => $logs->count(),
            'logs' => $logs,
            'actions' => self::ACTIONS,
        ]);
    }

    private function serialize(ActivityLog $log): array
    {
        $user = $log->user;

        return [
            'id' => $log->id,
            'action' => $log->action,
            'entity_type' => $log->entity_type,
            'entity_id' => $log->entity_id,
            'description' => $log->description,
            'meta' => $log->meta,
            'created_at' => $log->created_at?->toIso8601String(),
            'user' => $user ? [
                'id' => $user->id,
                'full_name' => trim($user->first_name.' '.$user->last_name),
                'username' => $user->username,
                'role' => $user->role,
            ] : [
                'id' => null,
                'full_name' => 'Unknown user',
                'username' => null,
                'role' => null,
            ],
        ];
    }
}
