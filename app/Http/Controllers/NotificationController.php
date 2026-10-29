<?php

namespace App\Http\Controllers;

use App\Models\CalendarNote;
use App\Models\IssuanceRequest;
use App\Models\NotificationRead;
use App\Models\ProcurementRequest;
use App\Models\ProcurementRequestDocument;
use App\Support\InventoryContext;
use App\Support\RolePermissions;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    // Status changes and new documents stay in the bell this long.
    private const RECENT_DAYS = 14;

    private const MAX_REQUEST_ALERTS = 50;

    private const PERSON_COLUMNS = 'id,first_name,last_name,username';

    public function alerts(Request $request): JsonResponse
    {
        $sessionUser = $request->session()->get('user');
        if (!is_array($sessionUser) || empty($sessionUser['id'])) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $alerts = [];

        if (RolePermissions::canAccessPage($sessionUser, 'calendar')) {
            array_push($alerts, ...$this->calendarAlerts($sessionUser));
        }

        // Requests belong to one inventory, so only the current one is checked.
        $inventoryId = InventoryContext::currentId($request);
        if ($inventoryId && RolePermissions::canAccessPage($sessionUser, 'procurement')) {
            array_push($alerts, ...$this->procurementAlerts($sessionUser, $inventoryId));
            array_push($alerts, ...$this->procurementDocumentAlerts($sessionUser, $inventoryId));
        }
        if ($inventoryId && RolePermissions::canAccessPage($sessionUser, 'issuance')) {
            array_push($alerts, ...$this->issuanceAlerts($sessionUser, $inventoryId));
        }

        return response()->json(['alerts' => $alerts]);
    }

    private function calendarAlerts(array $sessionUser): array
    {
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
                    'at' => $note->created_at?->toIso8601String(),
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
                    'at' => $today->toIso8601String(),
                ];
            }
        }

        return $alerts;
    }

    /**
     * Steps waiting on this user, and what happened to requests they submitted.
     * Ids include the status and RS number, so each new step or resubmission
     * shows up as a fresh unread notification.
     */
    private function procurementAlerts(array $sessionUser, int $inventoryId): array
    {
        $userId = (int) $sessionUser['id'];
        $cutoff = now()->subDays(self::RECENT_DAYS);

        $rows = ProcurementRequest::query()
            ->with(['uploader:'.self::PERSON_COLUMNS, 'reviewer:'.self::PERSON_COLUMNS])
            ->where('inventory_id', $inventoryId)
            ->where(function ($query) use ($userId, $cutoff) {
                $query
                    ->where(function ($q) use ($userId) {
                        $q->where('assigned_to', $userId)
                            ->where(function ($q) {
                                $q->whereIn('status', [
                                    ProcurementRequest::STATUS_PENDING,
                                    ProcurementRequest::STATUS_DEPT_NOTED,
                                    ProcurementRequest::STATUS_CHECKED,
                                ])->orWhere(function ($q) {
                                    $q->where('status', ProcurementRequest::STATUS_APPROVED)
                                        ->whereNull('stock_applied_at');
                                });
                            });
                    })
                    ->orWhere(function ($q) use ($userId, $cutoff) {
                        $q->where('uploaded_by', $userId)->where('updated_at', '>=', $cutoff);
                    });
            })
            ->orderByDesc('updated_at')
            ->limit(self::MAX_REQUEST_ALERTS)
            ->get();

        $stepVerbs = [
            ProcurementRequest::STEP_DEPT => 'note it as department head',
            ProcurementRequest::STEP_CHECK => 'check it for procurement',
            ProcurementRequest::STEP_MANAGER => 'give final approval',
        ];
        $soon = Carbon::today()->addDays(3);
        $alerts = [];

        foreach ($rows as $row) {
            $label = $row->rs_number ?: 'Request #'.$row->id;
            $key = $row->id.'-'.($row->rs_number ?: 'new');
            $href = '/procurement?request='.$row->id;
            $base = [
                'category' => 'Procurement',
                'href' => $href,
                'at' => $row->updated_at?->toIso8601String(),
            ];
            $assignedToMe = (int) $row->assigned_to === $userId;
            $submittedByMe = (int) $row->uploaded_by === $userId;
            $reviewedByMe = (int) $row->reviewed_by === $userId;
            $reviewerName = $row->reviewer?->full_name ?: 'A reviewer';

            if ($assignedToMe && $row->isInWorkflow()) {
                $from = $row->uploader?->full_name ?: 'Someone';
                $needed = $row->date_needed
                    ? ' · Needed by '.$row->date_needed->format('M j, Y')
                        .($row->date_needed->lt(Carbon::today()) ? ' (overdue)' : '')
                    : '';
                $alerts[] = $base + [
                    'id' => 'proc-step-'.$row->status.'-'.$key,
                    'type' => 'procurement_action',
                    'title' => "{$label} is waiting for you",
                    'message' => 'Please '.($stepVerbs[$row->currentStep()] ?? 'review it').". From {$from}{$needed}.",
                    'urgency' => $row->date_needed && $row->date_needed->lte($soon) ? 'critical' : 'high',
                    'badge' => 'Action',
                ];
                continue;
            }

            if ($assignedToMe && $row->status === ProcurementRequest::STATUS_APPROVED && !$row->stock_applied_at) {
                $alerts[] = $base + [
                    'id' => 'proc-receive-'.$key,
                    'type' => 'procurement_action',
                    'title' => "{$label} is approved",
                    'message' => 'Print the RS slip and enter the stock once it arrives.',
                    'urgency' => 'medium',
                    'badge' => 'To do',
                ];
            }

            if (!$submittedByMe || $row->updated_at?->lt($cutoff)) {
                continue;
            }

            // Updates on the requester's own slips, unless they made the change themselves.
            $update = match ($row->status) {
                ProcurementRequest::STATUS_DEPT_NOTED, ProcurementRequest::STATUS_CHECKED => $reviewedByMe ? null : [
                    'id' => 'proc-progress-'.$row->status.'-'.$key,
                    'title' => "{$label} moved forward",
                    'message' => $reviewerName.($row->status === ProcurementRequest::STATUS_DEPT_NOTED
                        ? ' noted it. It is now with procurement for checking.'
                        : ' checked it. It now waits for final approval.'),
                    'urgency' => 'medium',
                    'badge' => 'Update',
                ],
                ProcurementRequest::STATUS_APPROVED => $reviewedByMe || $assignedToMe ? null : [
                    'id' => 'proc-approved-'.$key,
                    'title' => "{$label} was approved",
                    'message' => "{$reviewerName} gave final approval.",
                    'urgency' => 'medium',
                    'badge' => 'Approved',
                ],
                ProcurementRequest::STATUS_DENIED => $reviewedByMe ? null : [
                    'id' => 'proc-denied-'.$key,
                    'title' => "{$label} was denied",
                    'message' => 'Reason: '.Str::limit(trim((string) $row->rejection_reason) ?: 'none given', 120),
                    'urgency' => 'high',
                    'badge' => 'Denied',
                ],
                ProcurementRequest::STATUS_STOCK_ENTERED => $assignedToMe ? null : [
                    'id' => 'proc-stock-'.$key,
                    'title' => "Stock received for {$label}",
                    'message' => 'The approved items were added to the inventory.',
                    'urgency' => 'medium',
                    'badge' => 'Received',
                ],
                default => null,
            };

            if ($update) {
                $alerts[] = $base + $update + ['type' => 'procurement_update'];
            }
        }

        return $alerts;
    }

    /** One alert per request when someone else adds documents to a slip this user submitted or holds. */
    private function procurementDocumentAlerts(array $sessionUser, int $inventoryId): array
    {
        $userId = (int) $sessionUser['id'];

        $documents = ProcurementRequestDocument::query()
            ->with([
                'uploader:'.self::PERSON_COLUMNS,
                'procurementRequest:id,rs_number',
            ])
            ->where('created_at', '>=', now()->subDays(self::RECENT_DAYS))
            ->whereNotNull('uploaded_by')
            ->where('uploaded_by', '!=', $userId)
            ->whereHas('procurementRequest', function ($q) use ($userId, $inventoryId) {
                $q->where('inventory_id', $inventoryId)
                    ->where(fn ($q) => $q->where('uploaded_by', $userId)->orWhere('assigned_to', $userId));
            })
            ->orderByDesc('id')
            ->limit(self::MAX_REQUEST_ALERTS)
            ->get();

        $alerts = [];
        foreach ($documents->groupBy('procurement_request_id') as $requestId => $docs) {
            $latest = $docs->first();
            $request = $latest->procurementRequest;
            $label = $request?->rs_number ?: 'Request #'.$requestId;
            $names = $docs->pluck('original_name')->take(3)->implode(', ');
            $more = $docs->count() > 3 ? ' and '.($docs->count() - 3).' more' : '';
            $who = $latest->uploader?->full_name ?: 'Someone';

            $alerts[] = [
                // The newest document id is in the key, so a later upload pings again.
                'id' => 'proc-docs-'.$requestId.'-'.$latest->id,
                'type' => 'procurement_docs',
                'category' => 'Procurement',
                'title' => "New document on {$label}",
                'message' => "{$who} added {$names}{$more}.",
                'urgency' => 'medium',
                'badge' => 'Document',
                'href' => '/procurement?request='.$requestId,
                'at' => $latest->created_at?->toIso8601String(),
            ];
        }

        return $alerts;
    }

    /** Pending slips for reviewers, and outcomes for the people who submitted them. */
    private function issuanceAlerts(array $sessionUser, int $inventoryId): array
    {
        $userId = (int) $sessionUser['id'];
        $canReview = RolePermissions::canReviewIssuance($sessionUser);
        $cutoff = now()->subDays(self::RECENT_DAYS);

        $rows = IssuanceRequest::query()
            ->with(['uploader:'.self::PERSON_COLUMNS, 'reviewer:'.self::PERSON_COLUMNS])
            ->withCount('items')
            ->where('inventory_id', $inventoryId)
            ->where(function ($query) use ($userId, $canReview, $cutoff) {
                $query->where(function ($q) use ($userId, $cutoff) {
                    $q->where('uploaded_by', $userId)->where('updated_at', '>=', $cutoff);
                });
                if ($canReview) {
                    $query->orWhere('status', IssuanceRequest::STATUS_PENDING);
                }
            })
            ->orderByDesc('updated_at')
            ->limit(self::MAX_REQUEST_ALERTS)
            ->get();

        $alerts = [];
        foreach ($rows as $row) {
            $label = 'Issuance request #'.$row->id;
            $base = [
                'category' => 'Issuance',
                'href' => '/issuance?request='.$row->id,
                'at' => $row->updated_at?->toIso8601String(),
            ];
            // A resubmission carries the old denial reason, so it pings reviewers again.
            $round = $row->previous_rejection_reason ? substr(md5($row->previous_rejection_reason), 0, 8) : '0';
            $reviewerName = $row->reviewer?->full_name ?: 'A reviewer';
            $submittedByMe = (int) $row->uploaded_by === $userId;
            $reviewedByMe = (int) $row->reviewed_by === $userId;

            if ($canReview && $row->isPending() && !$submittedByMe) {
                $from = $row->uploader?->full_name ?: 'Someone';
                $count = (int) $row->items_count;
                $alerts[] = $base + [
                    'id' => 'iss-pending-'.$row->id.'-'.$round,
                    'type' => 'issuance_action',
                    'title' => "{$label} needs review",
                    'message' => "{$from} asked for {$count} item".($count === 1 ? '' : 's')
                        .($row->previous_rejection_reason ? ' (resubmitted).' : '.'),
                    'urgency' => 'high',
                    'badge' => 'Review',
                ];
                continue;
            }

            if (!$submittedByMe || $reviewedByMe || $row->updated_at?->lt($cutoff)) {
                continue;
            }

            $update = match ($row->status) {
                IssuanceRequest::STATUS_APPROVED, IssuanceRequest::STATUS_STOCK_ENTERED => [
                    'id' => 'iss-approved-'.$row->id.'-'.$round,
                    'title' => "{$label} was approved",
                    'message' => "{$reviewerName} approved it and the items were issued.",
                    'urgency' => 'medium',
                    'badge' => 'Approved',
                ],
                IssuanceRequest::STATUS_DENIED => [
                    'id' => 'iss-denied-'.$row->id.'-'.$round,
                    'title' => "{$label} was denied",
                    'message' => 'Reason: '.Str::limit(trim((string) $row->rejection_reason) ?: 'none given', 120),
                    'urgency' => 'high',
                    'badge' => 'Denied',
                ],
                default => null,
            };

            if ($update) {
                $alerts[] = $base + $update + ['type' => 'issuance_update'];
            }
        }

        return $alerts;
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
