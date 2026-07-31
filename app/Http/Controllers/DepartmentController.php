<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Services\ActivityLogger;
use App\Services\PermissionService;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
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

        $departments = Department::with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (Department $dept) => $this->serialize($dept));

        return response()->json($departments);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $this->validated($request);

        $department = Department::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        $this->applyPermissions($department, $data);

        $this->activity->log(
            $request,
            'created',
            'Created department "'.$department->name.'"',
            'department',
            (int) $department->id
        );

        return response()->json($this->serialize($department->fresh(['permissions'])), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $department = Department::find($id);

        if (!$department) {
            return response()->json(['error' => 'Department not found'], 404);
        }

        $data = $this->validated($request, $department->id);
        $department->name = $data['name'];
        $department->description = $data['description'] ?? null;
        $department->save();

        $this->applyPermissions($department, $data);

        $this->activity->log(
            $request,
            'updated',
            'Updated department "'.$department->name.'"',
            'department',
            (int) $department->id
        );

        return response()->json($this->serialize($department->fresh(['permissions'])));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->guardManage($request)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $department = Department::withCount('users')->find($id);

        if (!$department) {
            return response()->json(['error' => 'Department not found'], 404);
        }

        if ($department->users_count > 0) {
            return response()->json([
                'error' => 'Cannot delete a department that still has users assigned',
            ], 422);
        }

        $name = $department->name;
        $department->delete();

        $this->activity->log(
            $request,
            'deleted',
            'Deleted department "'.$name.'"',
            'department',
            $id
        );

        return response()->json(['success' => true]);
    }

    private function guardManage(Request $request): bool
    {
        return RolePermissions::hasAbility($request->session()->get('user'), 'users.manage');
    }

    private function validated(Request $request, ?int $departmentId = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('departments', 'name')->ignore($departmentId),
            ],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.page' => ['required_with:permissions', 'string'],
            'permissions.*.ability' => ['required_with:permissions', 'string'],
            'page_flags' => ['nullable', 'array'],
        ]);
    }

    private function applyPermissions(Department $department, array $data): void
    {
        if (isset($data['page_flags']) && is_array($data['page_flags'])) {
            $rows = $this->permissions->permissionRowsFromFlags($data['page_flags']);
        } else {
            $rows = $data['permissions'] ?? [];
        }

        $this->permissions->syncDepartmentPermissions($department, $rows);
    }

    private function serialize(Department $department): array
    {
        return [
            'id' => $department->id,
            'name' => $department->name,
            'description' => $department->description,
            'users_count' => $department->users_count ?? $department->users()->count(),
            'created' => $department->created
                ? \Illuminate\Support\Carbon::parse($department->created)->toIso8601String()
                : null,
            'permissions' => $department->permissions->map(fn ($p) => [
                'page' => $p->page,
                'ability' => $p->ability,
            ])->values(),
        ];
    }
}
