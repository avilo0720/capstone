<?php

namespace App\Http\Controllers;

use App\Models\CalendarNote;
use App\Models\NotificationRead;
use App\Support\RolePermissions;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function alerts(Request $request): JsonResponse
    {
        $sessionUser = $request->session()->get('user');
        if (!is_array($sessionUser) || empty($sessionUser['id'])) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!RolePermissions::canAccessPage($sessionUser, 'calendar')) {
            return response()->json(['alerts' => []]);
        }

        $userId = (int) $sessionUser['id'];
        $today = Carbon::today();
        $todayStr = $today->toDateString();
        $sharedCutoff = $today->copy()->subDays(14)->startOfDay();

        $notes = CalendarNote::query()
            ->with(['creator:id,first_name,last_name,username'])
            ->visibleTo($sessionUser)
            ->orderByDesc('updated_at')
            ->get();

        $alerts = [];

        foreach ($notes as $note) {
            $start = $note->note_date?->toDateString();
            $end = ($note->end_date ?? $note->note_date)?->toDateString();
            if (!$start || !$end) {
                continue;
            }

            $creatorName = $note->creator?->full_name ?: 'Someone';
            $isSharedWithUser = (int) $note->created_by !== $userId;
            $stillRelevant = $end >= $todayStr
                || ($note->created_at && $note->created_at->gte($sharedCutoff));

            // Ping when a note was made/shared for this user
            if ($isSharedWithUser && $stillRelevant) {
                $alerts[] = [
                    'id' => 'note-shared-' . $note->id,
                    'type' => 'calendar_shared',
                    'title' => $note->title,
                    'message' => "{$creatorName} shared a calendar note with you.",
                    'note_date' => $start,
                    'end_date' => $end,
                    'urgency' => 'medium',
                    'href' => '/calendar?date=' . $start,
                ];
            }

            // Ping on each day the note covers
            if ($todayStr >= $start && $todayStr <= $end) {
                $dateLabel = $start === $end
                    ? Carbon::parse($start)->format('M j, Y')
                    : Carbon::parse($start)->format('M j') . ' – ' . Carbon::parse($end)->format('M j, Y');

                $alerts[] = [
                    'id' => 'note-due-' . $note->id . '-' . $todayStr,
                    'type' => 'calendar_due',
                    'title' => $note->title,
                    'message' => $isSharedWithUser
                        ? "Today's note from {$creatorName} · {$dateLabel}"
                        : "Your note is set for today · {$dateLabel}",
                    'note_date' => $start,
                    'end_date' => $end,
                    'urgency' => 'high',
                    'href' => '/calendar?date=' . $todayStr,
                ];
            }
        }

        return response()->json(['alerts' => $alerts]);
    }

    public function readIds(Request $request): JsonResponse
    {
        $userId = $this->currentUserId($request);
        if (!$userId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $ids = NotificationRead::query()
            ->where('user_id', $userId)
            ->pluck('notification_key')
            ->values()
            ->all();

        return response()->json(['readIds' => $ids]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $userId = $this->currentUserId($request);
        if (!$userId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string', 'max:100'],
        ]);

        $now = now();
        $rows = collect($validated['ids'])
            ->unique()
            ->map(fn (string $key) => [
                'user_id' => $userId,
                'notification_key' => $key,
                'read_at' => $now,
            ])
            ->values()
            ->all();

        NotificationRead::query()->upsert(
            $rows,
            ['user_id', 'notification_key'],
            ['read_at']
        );

        $ids = NotificationRead::query()
            ->where('user_id', $userId)
            ->pluck('notification_key')
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'readIds' => $ids,
        ]);
    }

    private function currentUserId(Request $request): ?int
    {
        $sessionUser = $request->session()->get('user');
        $id = $sessionUser['id'] ?? null;

        return $id ? (int) $id : null;
    }
}
