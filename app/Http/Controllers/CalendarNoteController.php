<?php

namespace App\Http\Controllers;

use App\Models\CalendarNote;
use App\Models\Department;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CalendarNoteController extends Controller
{
    public function options(Request $request): JsonResponse
    {
        if (!$this->sessionUser($request)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Department $d) => [
                'id' => $d->id,
                'name' => $d->name,
            ])
            ->values();

        $users = User::query()
            ->with('department:id,name')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'username', 'department_id'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'full_name' => $u->full_name,
                'username' => $u->username,
                'department_id' => $u->department_id,
                'department_name' => $u->department?->name,
            ])
            ->values();

        return response()->json([
            'departments' => $departments,
            'users' => $users,
            'colors' => CalendarNote::COLORS,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $sessionUser = $this->sessionUser($request);
        if (!$sessionUser) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'year' => ['required', 'integer'],
        ]);

        $monthStart = Carbon::create((int) $validated['year'], (int) $validated['month'], 1)->startOfDay();
        $monthEnd = $monthStart->copy()->endOfMonth()->startOfDay();

        $notes = CalendarNote::query()
            ->with([
                'creator:id,first_name,last_name,username',
                'departments:id,name',
                'viewers:id,first_name,last_name,username',
            ])
            ->visibleTo($sessionUser)
            ->whereDate('note_date', '<=', $monthEnd->toDateString())
            ->whereRaw('COALESCE(end_date, note_date) >= ?', [$monthStart->toDateString()])
            ->orderBy('note_date')
            ->orderBy('id')
            ->get()
            ->map(fn (CalendarNote $note) => $this->serialize($note, $sessionUser));

        return response()->json($notes);
    }

    public function store(Request $request): JsonResponse
    {
        $sessionUser = $this->sessionUser($request);
        if (!$sessionUser) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $data = $this->validated($request);

        $note = new CalendarNote([
            'created_by' => (int) $sessionUser['id'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'color' => $data['color'],
            'note_date' => $data['note_date'],
            'end_date' => $data['end_date'],
        ]);
        $note->save();

        $this->syncVisibility($note, $data);

        return response()->json(
            $this->serialize(
                $note->fresh(['creator', 'departments', 'viewers']),
                $sessionUser
            ),
            201
        );
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sessionUser = $this->sessionUser($request);
        if (!$sessionUser) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $note = CalendarNote::query()->find($id);
        if (!$note) {
            return response()->json(['error' => 'Note not found'], 404);
        }

        if (!$this->canManage($note, $sessionUser)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $this->validated($request);
        $note->fill([
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'color' => $data['color'],
            'note_date' => $data['note_date'],
            'end_date' => $data['end_date'],
        ]);
        $note->save();

        $this->syncVisibility($note, $data);

        return response()->json(
            $this->serialize(
                $note->fresh(['creator', 'departments', 'viewers']),
                $sessionUser
            )
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $sessionUser = $this->sessionUser($request);
        if (!$sessionUser) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $note = CalendarNote::query()->find($id);
        if (!$note) {
            return response()->json(['error' => 'Note not found'], 404);
        }

        if (!$this->canManage($note, $sessionUser)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $note->delete();

        return response()->json(['success' => true]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'body' => ['nullable', 'string', 'max:5000'],
            'color' => ['required', 'string', Rule::in(CalendarNote::COLORS)],
            'note_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date'],
            'department_ids' => ['nullable', 'array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $start = Carbon::parse($data['note_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'] ?? $data['note_date'])->startOfDay();

        if ($end->lt($start)) {
            throw ValidationException::withMessages([
                'end_date' => 'End date must be on or after the start date.',
            ]);
        }

        $data['note_date'] = $start->toDateString();
        $data['end_date'] = $end->toDateString();

        return $data;
    }

    private function syncVisibility(CalendarNote $note, array $data): void
    {
        $departmentIds = array_values(array_unique(array_map('intval', $data['department_ids'] ?? [])));
        $userIds = array_values(array_unique(array_map('intval', $data['user_ids'] ?? [])));

        $note->departments()->sync($departmentIds);
        $note->viewers()->sync($userIds);
    }

    private function serialize(CalendarNote $note, array $sessionUser): array
    {
        $departmentIds = $note->departments->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $userIds = $note->viewers->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $visibility = 'private';
        if ($departmentIds && $userIds) {
            $visibility = 'multiple';
        } elseif ($departmentIds) {
            $visibility = 'department';
        } elseif ($userIds) {
            $visibility = 'individual';
        }

        $start = $note->note_date?->format('Y-m-d');
        $end = ($note->end_date ?? $note->note_date)?->format('Y-m-d');

        return [
            'id' => $note->id,
            'title' => $note->title,
            'body' => $note->body,
            'color' => $note->color,
            'note_date' => $start,
            'end_date' => $end,
            'visibility' => $visibility,
            'department_ids' => $departmentIds,
            'user_ids' => $userIds,
            'departments' => $note->departments->map(fn (Department $d) => [
                'id' => $d->id,
                'name' => $d->name,
            ])->values(),
            'users' => $note->viewers->map(fn (User $u) => [
                'id' => $u->id,
                'full_name' => $u->full_name,
                'username' => $u->username,
            ])->values(),
            'created_by' => $note->created_by,
            'creator' => $note->creator ? [
                'id' => $note->creator->id,
                'full_name' => $note->creator->full_name,
                'username' => $note->creator->username,
            ] : null,
            'can_edit' => $this->canManage($note, $sessionUser),
            'created_at' => $note->created_at?->toIso8601String(),
            'updated_at' => $note->updated_at?->toIso8601String(),
        ];
    }

    private function canManage(CalendarNote $note, array $sessionUser): bool
    {
        $userId = (int) ($sessionUser['id'] ?? 0);

        return $note->created_by === $userId
            || !empty($sessionUser['canManageUsers']);
    }

    private function sessionUser(Request $request): ?array
    {
        $user = $request->session()->get('user');

        return is_array($user) ? $user : null;
    }
}
