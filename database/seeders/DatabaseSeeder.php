<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /** @var PermissionService $permissions */
        $permissions = app(PermissionService::class);

        $departmentDefs = [
            'Administrator' => [
                'description' => 'Full system access including user management',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'forecast' => ['view' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true],
                    'activity-logs' => ['view' => true],
                    'users' => ['view' => true, 'manage' => true],
                ],
            ],
            'Branch Manager' => [
                'description' => 'Full inventory operations access',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'forecast' => ['view' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true],
                ],
            ],
            'Department Manager' => [
                'description' => 'Department-level inventory operations',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'forecast' => ['view' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true],
                ],
            ],
            'Inventory Clerk' => [
                'description' => 'Inventory and forecasting without reports',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'forecast' => ['view' => true],
                    'calendar' => ['view' => true],
                ],
            ],
            'Warehouse Staff' => [
                'description' => 'View-only inventory access',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true],
                ],
            ],
        ];

        $departments = [];

        foreach ($departmentDefs as $name => $def) {
            $department = Department::updateOrCreate(
                ['name' => $name],
                ['description' => $def['description']]
            );

            $permissions->syncDepartmentPermissions(
                $department,
                $permissions->permissionRowsFromFlags($def['flags'])
            );

            $departments[$name] = $department;
        }

        $defaultUsers = [
            [
                'username' => 'admin',
                'first_name' => 'System',
                'last_name' => 'Admin',
                'birthday' => '1990-01-01',
                'role' => 'Administrator',
                'department' => 'Administrator',
                'password' => 'password123',
            ],
            [
                'username' => 'branch_manager',
                'first_name' => 'Branch',
                'last_name' => 'Manager',
                'birthday' => '1988-03-15',
                'role' => 'Branch Manager',
                'department' => 'Branch Manager',
                'password' => 'password123',
            ],
            [
                'username' => 'dept_manager',
                'first_name' => 'Department',
                'last_name' => 'Manager',
                'birthday' => '1991-07-22',
                'role' => 'Department Manager',
                'department' => 'Department Manager',
                'password' => 'password123',
            ],
            [
                'username' => 'inventory_clerk',
                'first_name' => 'Inventory',
                'last_name' => 'Clerk',
                'birthday' => '1995-11-08',
                'role' => 'Inventory Clerk',
                'department' => 'Inventory Clerk',
                'password' => 'password123',
            ],
            [
                'username' => 'warehouse_staff',
                'first_name' => 'Warehouse',
                'last_name' => 'Staff',
                'birthday' => '1998-05-30',
                'role' => 'Warehouse Staff',
                'department' => 'Warehouse Staff',
                'password' => 'password123',
            ],
        ];

        foreach ($defaultUsers as $userData) {
            User::updateOrCreate(
                ['username' => $userData['username']],
                [
                    'first_name' => $userData['first_name'],
                    'last_name' => $userData['last_name'],
                    'birthday' => $userData['birthday'],
                    'role' => $userData['role'],
                    'department_id' => $departments[$userData['department']]->id,
                    'use_custom_permissions' => false,
                    'password' => Hash::make($userData['password']),
                ]
            );
        }
    }
}
