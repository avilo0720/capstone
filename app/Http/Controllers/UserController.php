<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\PermissionService;
use App\Support\PermissionCatalog;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(
        private PermissionService $permissions,
        private ActivityLogger $activity,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $users = User::with(['department', 'permissions'])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (User $user) => $this->serialize($user));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $this->validated($request);

        $user = new User();
        $this->fillUser($user, $data);
        $user->password = Hash::make($data['password']);
        $user->save();

        $this->applyPermissions($user, $data);

        $this->activity->log(
            $request,
            'created',
            'Created user "'.$user->full_name.'" (@'.$user->username.')',
            'user',
            (int) $user->id,
            ['role' => $user->role]
        );

        return response()->json($this->serialize($user->fresh(['department', 'permissions'])), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $data = $this->validated($request, $user->id);
        $this->fillUser($user, $data);

        if (!empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();
        $this->applyPermissions($user, $data);

        $fresh = $user->fresh(['department', 'permissions']);
        $this->refreshSessionIfSelf($request, $fresh);

        $this->activity->log(
            $request,
            'updated',
            'Updated user "'.$fresh->full_name.'" (@'.$fresh->username.')',
            'user',
            (int) $fresh->id,
            ['role' => $fresh->role]
        );

        return response()->json($this->serialize($fresh));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $sessionUser = $request->session()->get('user');

        if ((int) ($sessionUser['id'] ?? 0) === $id) {
            return response()->json(['error' => 'You cannot delete your own account'], 422);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $name = $user->full_name;
        $username = $user->username;
        $user->delete();

        $this->activity->log(
            $request,
            'deleted',
            'Deleted user "'.$name.'" (@'.$username.')',
            'user',
            $id
        );

        return response()->json(['success' => true]);
    }

    public function catalog(Request $request): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return response()->json([
            'pages' => PermissionCatalog::PAGES,
        ]);
    }

    private function guardManage(Request $request): bool
    {
        return RolePermissions::hasAbility($request->session()->get('user'), 'users.manage');
    }

    private function validated(Request $request, ?int $userId = null): array
    {
        return $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->ignore($userId),
            ],
            'birthday' => ['nullable', 'date'],
            'role' => ['required', 'string', 'max:100'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'use_custom_permissions' => ['required', 'boolean'],
            'password' => [$userId ? 'nullable' : 'required', 'string', 'min:6'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.page' => ['required_with:permissions', 'string'],
            'permissions.*.ability' => ['required_with:permissions', 'string'],
            'page_flags' => ['nullable', 'array'],
        ]);
    }

    private function fillUser(User $user, array $data): void
    {
        $user->first_name = $data['first_name'];
        $user->last_name = $data['last_name'];
        $user->username = $data['username'];
        $user->birthday = $data['birthday'] ?? null;
        $user->role = $data['role'];
        $user->department_id = $data['department_id'] ?? null;
        $user->use_custom_permissions = (bool) $data['use_custom_permissions'];
    }

    private function applyPermissions(User $user, array $data): void
    {
        if (!$user->use_custom_permissions) {
            $user->permissions()->delete();

            return;
        }

        if (isset($data['page_flags']) && is_array($data['page_flags'])) {
            $rows = $this->permissions->permissionRowsFromFlags($data['page_flags']);
        } else {
            $rows = $data['permissions'] ?? [];
        }

        $this->permissions->syncUserPermissions($user, $rows);
    }

    private function serialize(User $user): array
    {
        $resolved = $this->permissions->resolve($user);

        return [
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'full_name' => $user->full_name,
            'username' => $user->username,
            'birthday' => $user->birthday?->format('Y-m-d'),
            'profile_picture' => $user->profile_picture_url,
            'role' => $user->role,
            'department_id' => $user->department_id,
            'department_name' => $user->department?->name,
            'use_custom_permissions' => (bool) $user->use_custom_permissions,
            'created' => $user->created
                ? \Illuminate\Support\Carbon::parse($user->created)->toIso8601String()
                : null,
            'permissions' => $user->permissions->map(fn ($p) => [
                'page' => $p->page,
                'ability' => $p->ability,
            ])->values(),
            'effective' => $resolved,
        ];
    }

    private function refreshSessionIfSelf(Request $request, User $user): void
    {
        $sessionUser = $request->session()->get('user');

        if ((int) ($sessionUser['id'] ?? 0) !== (int) $user->id) {
            return;
        }

        $request->session()->put('user', $this->permissions->sessionPayload($user));
    }
}
